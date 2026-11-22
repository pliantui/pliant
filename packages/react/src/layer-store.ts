import type { Op, Overlay } from "@pliantui/contract"
import {
  formatError,
  loadOverlay,
  opProperties,
  resolveLayers,
  validateOverlay,
  type LoadedOverlay,
  type ResolvedLayers,
} from "@pliantui/core"

import { createFieldRegistry, type FieldRegistry } from "./field-registry"
import type { LayerTools } from "./layer-tools"
import { planLockIn } from "./lock-in"
import { settleManual, splitManual } from "./manual-changes"
import { manualOverlay } from "./manual-overlay"
import { identityOf } from "./node-identity"
import { createNodeRegistry } from "./node-registry"
import { idOf, mergeById, withOps } from "./overlay-list"
import { loadingStatus, readyStatus, type PliantStatus } from "./pliant-status"
import type {
  ApplyOpsOptions,
  LockInResult,
  OverlayResult,
  PliantStore,
  ResetNodeResult,
} from "./pliant-store"
import { changeKeyOf } from "./property-keys"
import { viewOf } from "./resolved-view"
import { createRetention, type Retention } from "./retention"
import { createSaveQueue } from "./save-queue"
import { readSession, writeSession } from "./session-mirror"
import { createSlotRegistry, type SlotRegistry } from "./slot-registry"
import type { StorageAdapter, StoredLayers } from "./storage-adapter"
import { isStorageConflictError } from "./storage-conflict-error"
import { checkLanguage, uiLanguage } from "./ui-language"
import { ulid } from "./ulid"

export interface LayerStoreOptions {
  readonly surface: string
  readonly storage: StorageAdapter
  readonly teamOrder?: readonly string[] | undefined
  readonly onError?: ((error: unknown) => void) | undefined
  /** The UI language, as `PliantRoot`'s `lang` prop. */
  readonly lang?: string | undefined
  /** The layers loaded during the server render, as `PliantRoot`'s `layers`. */
  readonly layers?: StoredLayers | undefined
  readonly now?: (() => number) | undefined
  readonly generateId?: ((time: number) => string) | undefined
  /** Whether changes replace earlier ones; off only to test that it's exact. */
  readonly coalesce?: boolean | undefined
}

export interface LayerStore {
  readonly surface: string
  readonly actions: PliantStore
  readonly subscribe: (listener: () => void) => () => void
  readonly getResolved: () => ResolvedLayers
  readonly getServerResolved: () => ResolvedLayers
  readonly getPreview: () => LoadedOverlay | null
  readonly getStatus: () => PliantStatus
  readonly getServerStatus: () => PliantStatus
  readonly registerNodes: (ids: readonly string[]) => () => void
  readonly registerFields: FieldRegistry["register"]
  readonly slots: SlotRegistry
  readonly retention: Retention
  readonly setTeamOrder: (teamOrder: readonly string[]) => void
  readonly setOnError: (onError: ((error: unknown) => void) | undefined) => void
  readonly setLang: (lang: string | undefined) => void
  readonly connect: () => () => void
  readonly flush: () => void
  /** Reports an error to `onError`, or `console.error` without one. */
  readonly report: (error: unknown) => void
}

// A node's placement, span, visibility and insertion belong to its
// container, so a reset leaves them.
const placeProperties = new Set(["placement", "visible", "inserted", "span"])

// What a region resets for its slots. A removal stays, so a node the user
// inserted and then removed doesn't come back.
const slotProperties = new Set(["placement", "visible", "span"])

// Whether a valid op writes a property of the node with this identity, or of
// one of its items, such as a column, other than those its container owns.
// A slot's placement and visibility are kept under its bare id, so they're
// the node's when the op addresses the slot through it, as
// `key-metrics/slots/overdue` (at any depth) does.
function writesNode(op: Op, identity: string) {
  return opProperties(op).some(
    ({ address, property }) =>
      address.startsWith(`${identity}/`) ||
      (address === identity
        ? !placeProperties.has(property)
        : slotProperties.has(property) &&
          !address.includes("/") &&
          op.target.endsWith(`/slots/${address}`) &&
          identityOf(op.target.slice(0, -7 - address.length)) === identity)
  )
}

export function createLayerStore({
  surface,
  storage,
  teamOrder: initialTeamOrder = [],
  onError: initialOnError,
  lang: initialLang,
  layers: initialLayers,
  now = Date.now,
  generateId = ulid,
  coalesce = true,
}: LayerStoreOptions): LayerStore {
  const listeners = new Set<() => void>()
  const loaded = new WeakMap<object, LoadedOverlay | undefined>()
  const keys = new WeakMap<LoadedOverlay, string | undefined>()
  const { ids, sync, register } = createNodeRegistry(changeLayers)
  const fieldRegistry = createFieldRegistry(changeLayers)
  // The ids of the personal overlays known to be stored.
  const stored = new Set<unknown>()
  // The etag of each stored personal overlay, by id.
  const etagOf = new Map<unknown, string>()
  // The personal overlays `resetNode` removed, by id: never shown again,
  // and removed from storage once stored.
  const removed = new Set<unknown>()
  const { flush, save, defer, pendingId, settle } = createSaveQueue({
    write(overlay) {
      const sentAt = loadCount
      try {
        const saved = storage.save(surface, overlay, { ifMatch: null })
        if (saved instanceof Promise) {
          return saved.then(
            (record) => {
              storedAs(overlay.id, record.etag)
              confirm(overlay.id, sentAt)
            },
            (error: unknown) => {
              resolveConflict(overlay, error, sentAt)
            }
          )
        }
        storedAs(overlay.id, saved.etag)
        stored.add(overlay.id)
      } catch (error) {
        resolveConflict(overlay, error, sentAt)
      }
      return undefined
    },
    report,
    now,
  })
  const tools: LayerTools = {
    surface,
    generateId,
    tick,
    language: () => uiLanguage(lang),
    load,
    resolve,
    validateAbove,
  }

  let teamOrder = initialTeamOrder
  let onError = initialOnError
  let lang = checkLanguage(initialLang)
  let status = loadingStatus
  let org: readonly unknown[] = []
  let team: readonly unknown[] = []
  let personal: readonly unknown[] = []
  let session: readonly unknown[] = []
  let previewed: object | null = null
  let connection: object | undefined
  let currentLoad: object | undefined
  let changedWhileLoading = false
  let loadCount = 0
  let loadedEtags: string | undefined
  let version = 0
  let lastTime = 0
  let snapshot: { version: number; resolved: ResolvedLayers } | undefined
  let serverSnapshot: ResolvedLayers | undefined

  function report(error: unknown) {
    if (onError) {
      onError(error)
    } else {
      console.error(error)
    }
  }

  function load(input: unknown) {
    if (typeof input !== "object" || input === null) {
      return undefined
    }
    if (!loaded.has(input)) {
      const result = loadOverlay(input)
      loaded.set(input, result.success ? result.data : undefined)
    }
    return loaded.get(input)
  }

  function keyOf(overlay: LoadedOverlay) {
    if (!keys.has(overlay)) {
      keys.set(overlay, changeKeyOf(overlay))
    }
    return keys.get(overlay)
  }

  // Strictly increasing, and never before a loaded overlay, so a change
  // never sorts before an earlier one, even after a reload or when a saved
  // overlay's clock was ahead.
  function tick() {
    lastTime = Math.max(now(), lastTime + 1)
    return lastTime
  }

  function seed(inputs: readonly unknown[]) {
    for (const input of inputs) {
      const time = Date.parse(load(input)?.createdAt ?? "")
      if (time > lastTime) {
        lastTime = time
      }
    }
  }

  function resolve(inputs: readonly unknown[]) {
    return resolveLayers(
      inputs.flatMap((input) => load(input) ?? []),
      {
        surface,
        baseIds: { ids: ids(), source: "mounted" },
        teamOrder,
        ...fieldRegistry.options(),
      }
    )
  }

  function validateAbove(input: unknown, overlays: readonly unknown[]) {
    const { fields, flags } = fieldRegistry.options()
    return validateOverlay(input, {
      layers: {
        overlays,
        surface,
        baseIds: { ids: ids(), source: "mounted" },
        teamOrder,
        flags,
      },
      fields,
    })
  }

  function notify() {
    for (const listener of listeners) {
      listener()
    }
  }

  function changeLayers() {
    version++
    notify()
  }

  function setStatus(next: PliantStatus) {
    status = next
    notify()
  }

  function mirror() {
    if (connection) {
      writeSession(surface, { overlays: session, preview: previewed })
    }
  }

  function savePersonal(overlay: Overlay) {
    personal = [...personal, overlay]
    save(overlay)
  }

  function storedAs(id: unknown, etag: unknown) {
    if (typeof etag === "string") {
      etagOf.set(id, etag)
    }
    removeStored(id)
  }

  // A removal that fails leaves the overlay stored, to show again after a
  // reload, so the error is reported.
  function removeStored(id: unknown) {
    const etag = etagOf.get(id)
    if (removed.has(id) && etag !== undefined && typeof id === "string") {
      etagOf.delete(id)
      Promise.resolve()
        .then(() => storage.remove?.(surface, id, { ifMatch: etag }))
        .catch(report)
    }
  }

  // Each personal version gets a new id in this tab and is saved once, as
  // a new record, so a conflict over that id means an earlier attempt was
  // stored though its answer was lost. The stored overlay replaces this
  // tab's copy, since the adapter may have normalized it, unless it was
  // removed since: then the version is dropped. A version a load showed
  // stored is saved whatever the answer says, so a late failure can't
  // store it again after it was removed elsewhere.
  function resolveConflict(overlay: Overlay, error: unknown, sentAt: number) {
    if (stored.has(overlay.id)) {
      return
    }
    const record = isStorageConflictError(error) ? error.current : undefined
    const current = record?.overlay
    if (current?.id !== overlay.id) {
      throw error
    }
    if (record?.deletedAt) {
      personal = personal.filter((saved) => idOf(saved) !== overlay.id)
      changeLayers()
      return
    }
    seed([current])
    storedAs(current.id, record?.etag)
    personal = personal.map((saved) =>
      idOf(saved) === overlay.id ? current : saved
    )
    changeLayers()
    confirm(overlay.id, sentAt)
  }

  // A load that started after the save was sent kept the version as still
  // being saved, though it may have been removed elsewhere since: one more
  // load tells.
  function confirm(id: string, sentAt: number) {
    if (stored.has(id)) {
      return
    }
    stored.add(id)
    if (loadCount !== sentAt) {
      fetchLayers(true)
    }
  }

  function lowerOf(layer: "personal" | "session") {
    return layer === "personal"
      ? [...org, ...team, ...personal]
      : [...org, ...team, ...personal, ...session]
  }

  function notReady():
    { readonly success: false; readonly error: string } | undefined {
    return status === readyStatus
      ? undefined
      : {
          success: false,
          error: `The layers of ${surface} haven't loaded yet`,
        }
  }

  function validate(
    input: unknown,
    layer: "personal" | "session"
  ): OverlayResult {
    sync()
    const result = validateAbove(input, lowerOf(layer))
    return result.success
      ? { success: true, overlay: result.data }
      : { success: false, error: formatError(result.error) }
  }

  function replacedId(layer: "personal" | "session", key: string) {
    if (!coalesce) {
      return undefined
    }
    if (layer === "personal") {
      return pendingId(key)
    }
    return idOf(
      session.find((input) => {
        const overlay = load(input)
        return overlay !== undefined && keyOf(overlay) === key
      })
    )
  }

  function applyOps(
    layer: "personal" | "session",
    ops: readonly Op[],
    { explain }: ApplyOpsOptions = {}
  ): OverlayResult {
    const rejected = notReady()
    if (rejected) {
      return rejected
    }
    const candidate = manualOverlay(tools, layer, ops, tick(), explain)
    const loadedCandidate = loadOverlay(candidate)
    const key = loadedCandidate.success
      ? keyOf(loadedCandidate.data)
      : undefined
    const id = key === undefined ? undefined : replacedId(layer, key)
    const result = validate(
      id === undefined ? candidate : { ...candidate, id },
      layer
    )
    if (!result.success) {
      return result
    }
    const { overlay } = result
    if (layer === "personal") {
      if (id === undefined) {
        flush()
      }
      personal = [
        ...personal.filter((saved) => idOf(saved) !== overlay.id),
        overlay,
      ]
      defer(overlay, key)
    } else {
      session = [
        ...session.filter((saved) => idOf(saved) !== overlay.id),
        overlay,
      ]
      mirror()
    }
    changeLayers()
    return result
  }

  // The ops of an overlay a reset of the node keeps, when it drops any.
  function resetOf(input: unknown, identity: string) {
    const overlay = load(input)
    const keep = overlay?.ops.map(
      (check) => check.status !== "valid" || !writesNode(check.op, identity)
    )
    return overlay && keep?.includes(false) ? { overlay, keep } : undefined
  }

  function resetNode(target: string): ResetNodeResult {
    const rejected = notReady()
    if (rejected) {
      return rejected
    }
    const identity = identityOf(target)
    const changed = personal.flatMap((input) => resetOf(input, identity) ?? [])
    if (changed.length > 0 && !storage.remove) {
      const error = `The storage adapter of ${surface} can't remove overlays`
      // A setup error, so the app hears of it whichever component asked.
      report(new Error(error))
      return { success: false, error }
    }
    session = session.flatMap((input) => {
      const reset = resetOf(input, identity)
      if (!reset) {
        return [input]
      }
      const { overlay, keep } = reset
      return keep.includes(true)
        ? [withOps(overlay, (index) => keep[index] === true)]
        : []
    })
    // Waiting versions are sent first, so each is removed once stored.
    flush()
    for (const { overlay, keep } of changed) {
      personal = personal.filter((input) => idOf(input) !== overlay.id)
      removed.add(overlay.id)
      removeStored(overlay.id)
      // The ops kept become a new version at the same time, so they apply
      // in the same order.
      if (keep.includes(true)) {
        savePersonal({
          ...withOps(overlay, (index) => keep[index] === true),
          id: generateId(Date.parse(overlay.createdAt)),
        })
      }
    }
    mirror()
    changeLayers()
    return { success: true }
  }

  function preview(input: unknown): OverlayResult {
    const rejected = notReady()
    if (rejected) {
      return rejected
    }
    const result = validate(input, "session")
    if (!result.success) {
      return result
    }
    if (result.overlay.layer !== "session") {
      return {
        success: false,
        error: "layer: A preview must be a session overlay",
      }
    }
    if (previewed !== null) {
      endPreview()
    }
    // Restamped so the preview sorts after every session change made before
    // it, whatever the clock of the server that made it.
    const overlay = {
      ...result.overlay,
      createdAt: new Date(tick()).toISOString(),
    }
    previewed = overlay
    mirror()
    changeLayers()
    return { success: true, overlay }
  }

  // Ends the preview as `discard` does, keeping the changes made while it
  // showed. When they can't move without rendering differently, they stay
  // where they were, which renders the same.
  function endPreview() {
    const target = viewOf(resolve([...org, ...team, ...personal, ...session]))
    const manual = splitManual(tools, session, previewed)
    previewed = null
    const settled = settleManual(
      tools,
      manual.overlays,
      target,
      lowerOf("personal"),
      manual.session
    )
    if (!settled) {
      return
    }
    if (settled.version) {
      flush()
      savePersonal(settled.version)
    }
    session = settled.session
  }

  function lockIn(): LockInResult {
    const rejected = notReady()
    if (rejected) {
      return rejected
    }
    const plan = planLockIn(
      tools,
      lowerOf("personal"),
      session,
      previewed,
      viewOf(getResolved())
    )
    if (!plan.success) {
      return plan
    }
    const { locked, kept, settled } = plan
    flush()
    if (locked) {
      savePersonal(locked)
    }
    if (settled.version) {
      savePersonal(settled.version)
    }
    session = settled.session
    previewed = null
    mirror()
    changeLayers()
    return {
      success: true,
      overlay: locked ?? null,
      keptInSession: kept?.ops ?? [],
    }
  }

  function discard() {
    if (previewed !== null) {
      endPreview()
      mirror()
      changeLayers()
    }
  }

  // A tombstone is never applied, even from an adapter that loads one.
  function recordsOf(records: readonly unknown[] = []) {
    return records.flatMap((record: unknown) =>
      typeof record === "object" &&
      record !== null &&
      "overlay" in record &&
      !("deletedAt" in record && record.deletedAt)
        ? [{ overlay: record.overlay, etag: "etag" in record && record.etag }]
        : []
    )
  }

  // Personal overlays stored before the load started and missing from it
  // were removed elsewhere. The others not in it are still being saved.
  function hydrate(
    token: object,
    layers: StoredLayers,
    storedBefore: ReadonlySet<unknown>
  ) {
    if (currentLoad !== token) {
      return
    }
    const records = [layers.org, layers.team, layers.personal].map(recordsOf)
    const etags = JSON.stringify(
      records.map((layer) => layer.map(({ etag }) => etag))
    )
    const loadedIds = new Set(
      records[2]?.map(({ overlay }) => idOf(overlay)) ?? []
    )
    if (
      status !== readyStatus ||
      etags !== loadedEtags ||
      personal.some(
        (overlay) =>
          storedBefore.has(idOf(overlay)) && !loadedIds.has(idOf(overlay))
      )
    ) {
      loadedEtags = etags
      const [orgRecords = [], teamRecords = [], personalRecords = []] = records
      for (const { overlay, etag } of personalRecords) {
        storedAs(idOf(overlay), etag)
      }
      const saved = personalRecords.flatMap(({ overlay }) =>
        removed.has(idOf(overlay)) ? [] : [overlay]
      )
      org = orgRecords.map(({ overlay }) => overlay)
      team = teamRecords.map(({ overlay }) => overlay)
      personal = mergeById(
        saved,
        personal.filter((overlay) => !storedBefore.has(idOf(overlay)))
      )
      for (const overlay of saved) {
        const id = idOf(overlay)
        stored.add(id)
        if (typeof id === "string") {
          settle(id)
        }
      }
      seed(saved)
      if (
        version > 0 ||
        org.length > 0 ||
        team.length > 0 ||
        saved.length > 0
      ) {
        version++
      }
      setStatus(readyStatus)
    }
    settled()
  }

  // Changes reported while a load runs are read by one more load after it.
  function settled() {
    currentLoad = undefined
    if (changedWhileLoading) {
      changedWhileLoading = false
      fetchLayers(true)
    }
  }

  // A quiet load, after a change elsewhere, keeps what shows until it
  // succeeds, and reports a failure to `onError` once the layers are ready.
  function fetchLayers(quiet: boolean) {
    if (!connection) {
      return
    }
    if (quiet && currentLoad) {
      changedWhileLoading = true
      return
    }
    const token = {}
    const storedBefore = new Set(stored)
    currentLoad = token
    loadCount++
    if (!quiet && status !== loadingStatus) {
      setStatus(loadingStatus)
    }
    function fail(error: unknown) {
      if (currentLoad !== token) {
        return
      }
      if (quiet && status === readyStatus) {
        report(error)
      } else {
        setStatus({ status: "error", error })
      }
      settled()
    }
    let layers: StoredLayers | Promise<StoredLayers>
    try {
      layers = storage.load(surface)
    } catch (error) {
      fail(error)
      return
    }
    if (layers instanceof Promise) {
      layers.then((loaded) => {
        hydrate(token, loaded, storedBefore)
      }, fail)
    } else {
      hydrate(token, layers, storedBefore)
    }
  }

  function reload() {
    fetchLayers(false)
  }

  function getServerResolved() {
    serverSnapshot ??= resolve(initial)
    return serverSnapshot
  }

  function getResolved() {
    if (version === 0) {
      return getServerResolved()
    }
    if (snapshot?.version !== version) {
      snapshot = {
        version,
        resolved: resolve([
          ...org,
          ...team,
          ...personal,
          ...session,
          ...(previewed ? [previewed] : []),
        ]),
      }
    }
    return snapshot.resolved
  }

  function connect() {
    const token = {}
    connection = token
    const restored = readSession(surface)
    session = mergeById(restored.overlays, session)
    if (
      previewed === null &&
      typeof restored.preview === "object" &&
      restored.preview !== null
    ) {
      previewed = restored.preview
    }
    seed([...session, previewed])
    if (session.length > 0 || previewed !== null) {
      changeLayers()
    }
    mirror()
    // A burst of changes, such as many `storage` events, loads once.
    let changed = false
    const unsubscribe = storage.subscribe?.(surface, () => {
      if (!changed) {
        changed = true
        queueMicrotask(() => {
          changed = false
          fetchLayers(true)
        })
      }
    })
    fetchLayers(status === readyStatus)

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flush()
      }
    }
    window.addEventListener("pagehide", flush)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      connection = undefined
      currentLoad = undefined
      flush()
      window.removeEventListener("pagehide", flush)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      unsubscribe?.()
    }
  }

  if (initialLayers) {
    currentLoad = {}
    hydrate(currentLoad, initialLayers, new Set())
  }
  const initial = [...org, ...team, ...personal]
  const serverStatus = status

  return {
    surface,
    actions: { applyOps, preview, lockIn, discard, reload, resetNode },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getResolved,
    getServerResolved,
    getPreview() {
      return load(previewed) ?? null
    },
    getStatus() {
      return status
    },
    getServerStatus: () => serverStatus,
    registerNodes: register,
    registerFields: fieldRegistry.register,
    slots: createSlotRegistry(),
    retention: createRetention(),
    setTeamOrder(next) {
      if (JSON.stringify(next) !== JSON.stringify(teamOrder)) {
        teamOrder = next
        changeLayers()
      }
    },
    setOnError(next) {
      onError = next
    },
    setLang(next) {
      lang = checkLanguage(next)
    },
    connect,
    flush,
    report,
  }
}
