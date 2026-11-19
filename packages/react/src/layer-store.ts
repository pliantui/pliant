import type { Op } from "@pliantui/contract"
import {
  formatError,
  loadOverlay,
  resolveLayers,
  validateOverlay,
  type LoadedOverlay,
  type ResolvedLayers,
  type ValidatedOverlay,
} from "@pliantui/core"

import type { LayerTools } from "./layer-tools"
import { planLockIn } from "./lock-in"
import { settleManual, splitManual } from "./manual-changes"
import { manualOverlay } from "./manual-overlay"
import { createNodeRegistry } from "./node-registry"
import { idOf, mergeById } from "./overlay-list"
import { loadingStatus, readyStatus, type PliantStatus } from "./pliant-status"
import type {
  ApplyOpsOptions,
  LockInResult,
  OverlayResult,
  PliantStore,
} from "./pliant-store"
import { changeKeyOf } from "./property-keys"
import { viewOf } from "./resolved-view"
import { createRetention, type Retention } from "./retention"
import { createSaveQueue } from "./save-queue"
import { readSession, writeSession } from "./session-mirror"
import { createSlotRegistry, type SlotRegistry } from "./slot-registry"
import type { StorageAdapter, StoredLayers } from "./storage-adapter"
import { ulid } from "./ulid"

export interface LayerStoreOptions {
  readonly surface: string
  readonly storage: StorageAdapter
  readonly teamOrder?: readonly string[] | undefined
  readonly onError?: ((error: unknown) => void) | undefined
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
  readonly registerNodes: (ids: readonly string[]) => () => void
  readonly slots: SlotRegistry
  readonly retention: Retention
  readonly setTeamOrder: (teamOrder: readonly string[]) => void
  readonly setOnError: (onError: ((error: unknown) => void) | undefined) => void
  readonly connect: () => () => void
  readonly flush: () => void
  /** Reports an error to `onError`, or `console.error` without one. */
  readonly report: (error: unknown) => void
}

export function createLayerStore({
  surface,
  storage,
  teamOrder: initialTeamOrder = [],
  onError: initialOnError,
  now = Date.now,
  generateId = ulid,
  coalesce = true,
}: LayerStoreOptions): LayerStore {
  const listeners = new Set<() => void>()
  const loaded = new WeakMap<object, LoadedOverlay | undefined>()
  const keys = new WeakMap<LoadedOverlay, string | undefined>()
  const { ids, sync, register } = createNodeRegistry(changeLayers)
  const { flush, save, defer, pendingId } = createSaveQueue({
    write: (overlay) => storage.save(surface, overlay),
    report,
    now,
  })
  const tools: LayerTools = {
    surface,
    generateId,
    tick,
    load,
    resolve,
    validateAbove,
  }

  let teamOrder = initialTeamOrder
  let onError = initialOnError
  let status = loadingStatus
  let org: readonly unknown[] = []
  let team: readonly unknown[] = []
  let personal: readonly unknown[] = []
  let session: readonly unknown[] = []
  let previewed: object | null = null
  let connection: object | undefined
  let currentLoad: object | undefined
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
      { surface, baseIds: { ids: ids(), source: "mounted" }, teamOrder }
    )
  }

  function validateAbove(input: unknown, overlays: readonly unknown[]) {
    return validateOverlay(input, {
      layers: {
        overlays,
        surface,
        baseIds: { ids: ids(), source: "mounted" },
        teamOrder,
      },
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

  function savePersonal(overlay: ValidatedOverlay) {
    personal = [...personal, overlay]
    save(overlay)
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

  function hydrate(token: object, stored: StoredLayers) {
    if (currentLoad !== token) {
      return
    }
    const saved = stored.personal ?? []
    org = stored.org ?? []
    team = stored.team ?? []
    personal = mergeById(saved, personal)
    seed(saved)
    if (org.length > 0 || team.length > 0 || saved.length > 0) {
      version++
    }
    setStatus(readyStatus)
  }

  function reload() {
    if (!connection) {
      return
    }
    const token = {}
    currentLoad = token
    if (status !== loadingStatus) {
      setStatus(loadingStatus)
    }
    let stored: StoredLayers | Promise<StoredLayers>
    try {
      stored = storage.load(surface)
    } catch (error) {
      setStatus({ status: "error", error })
      return
    }
    if (stored instanceof Promise) {
      stored.then(
        (layers) => {
          hydrate(token, layers)
        },
        (error: unknown) => {
          if (currentLoad === token) {
            setStatus({ status: "error", error })
          }
        }
      )
    } else {
      hydrate(token, stored)
    }
  }

  function getServerResolved() {
    serverSnapshot ??= resolve([])
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
    reload()

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
    }
  }

  return {
    surface,
    actions: { applyOps, preview, lockIn, discard, reload },
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
    registerNodes: register,
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
    connect,
    flush,
    report,
  }
}
