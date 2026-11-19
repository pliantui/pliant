import { opCatalog, type Op } from "@pliantui/contract"
import {
  formatError,
  loadOverlay,
  resolveLayers,
  validateOverlay,
  type LoadedOverlay,
  type ResolvedLayers,
  type ValidatedOverlay,
} from "@pliantui/core"

import { changeKeyOf, propertiesOf } from "./property-keys"
import { readSession, writeSession } from "./session-mirror"
import type { StorageAdapter, StoredLayers } from "./storage-adapter"
import { ulid } from "./ulid"

declare const __PLIANT_CORE_VERSION__: string

const coalesceWindow = 1000

/**
 * The overlay a change made, or why it was rejected, as `formatError`
 * formats it.
 *
 * @experimental
 */
export type OverlayResult =
  | { readonly success: true; readonly overlay: ValidatedOverlay }
  | { readonly success: false; readonly error: string }

/** @experimental */
export interface ApplyOpsOptions {
  /** One short sentence per op, shown in history. */
  readonly explain?: readonly string[] | undefined
}

/**
 * Whether the surface's layers have loaded from the storage adapter. Until
 * they are `ready`, nothing can change them, and the server render and the
 * first client render resolve no overlays.
 *
 * @experimental
 */
export type PliantStatus =
  | { readonly status: "loading" }
  | { readonly status: "ready" }
  | { readonly status: "error"; readonly error: unknown }

/**
 * Changes the layers of the surface that the nearest `PliantRoot` holds.
 *
 * Each tab holds its own copy of the layers: another tab's changes show
 * after a reload.
 *
 * @experimental
 */
export interface PliantStore {
  /**
   * Applies ops as one overlay on the personal or session layer, made with
   * `source: "manual"`, `createdBy: "local"` and `basis.manifests: {}`. The
   * manifest versions aren't known here yet; they must be filled in before
   * migrations rely on them.
   *
   * The overlay is validated against the layers below it and the mounted
   * nodes, and rejected as a whole when any op is invalid. It is also
   * rejected until the layers are `ready` (see `usePliantStatus`), rather
   * than validated against layers that haven't loaded.
   *
   * A personal change that writes exactly the properties of the previous
   * one, within 1s of it, replaces it, so dragging a column width saves one
   * version. Personal changes are saved after 1s without another one, and
   * when the page is hidden or unloads. A session change replaces the
   * session overlay that wrote exactly the same properties.
   */
  readonly applyOps: (
    layer: "personal" | "session",
    ops: readonly Op[],
    options?: ApplyOpsOptions
  ) => OverlayResult
  /**
   * Shows a session overlay, such as an AI answer, on top of every layer
   * until `lockIn` or `discard`. It replaces the current preview.
   */
  readonly preview: (overlay: unknown) => OverlayResult
  /**
   * Ends the preview by keeping it: its ops become a new personal version,
   * saved at once, and the session changes to the properties they write are
   * dropped, so they can't hide it. Ops allowed only in the session layer,
   * such as `setPage`, stay in the session layer instead. The result is the
   * personal version, or the session overlay when every op is session-only.
   */
  readonly lockIn: () => OverlayResult
  /** Drops the preview. */
  readonly discard: () => void
  /** Loads the layers from the storage adapter again, as after an error. */
  readonly reload: () => void
}

export interface LayerStoreOptions {
  readonly surface: string
  readonly storage: StorageAdapter
  readonly teamOrder?: readonly string[] | undefined
  readonly onError?: ((error: unknown) => void) | undefined
  readonly now?: (() => number) | undefined
  readonly generateId?: ((time: number) => string) | undefined
}

export interface LayerStore {
  readonly actions: PliantStore
  readonly subscribe: (listener: () => void) => () => void
  readonly getResolved: () => ResolvedLayers
  readonly getServerResolved: () => ResolvedLayers
  readonly getPreview: () => LoadedOverlay | null
  readonly getStatus: () => PliantStatus
  readonly registerNodes: (ids: readonly string[]) => () => void
  readonly setTeamOrder: (teamOrder: readonly string[]) => void
  readonly setOnError: (onError: ((error: unknown) => void) | undefined) => void
  readonly connect: () => () => void
  readonly flush: () => void
}

export const loadingStatus: PliantStatus = { status: "loading" }
const readyStatus: PliantStatus = { status: "ready" }

interface PendingVersion {
  readonly overlay: ValidatedOverlay
  readonly key: string | undefined
  readonly at: number
}

function idOf(input: unknown) {
  return typeof input === "object" && input !== null && "id" in input
    ? input.id
    : undefined
}

function mergeById(saved: readonly unknown[], current: readonly unknown[]) {
  const ids = new Set(current.map(idOf))
  return [
    ...saved.filter((overlay) => {
      const id = idOf(overlay)
      return id === undefined || !ids.has(id)
    }),
    ...current,
  ]
}

function withOps(
  { explain, ...overlay }: LoadedOverlay,
  keep: (index: number) => boolean
) {
  const ops = overlay.ops.filter((_, index) => keep(index))
  return {
    ...overlay,
    ops: ops.map((check) => check.op),
    ...(explain ? { explain: explain.filter((_, index) => keep(index)) } : {}),
  }
}

export function createLayerStore({
  surface,
  storage,
  teamOrder: initialTeamOrder = [],
  onError: initialOnError,
  now = Date.now,
  generateId = ulid,
}: LayerStoreOptions): LayerStore {
  const listeners = new Set<() => void>()
  const loaded = new WeakMap<object, LoadedOverlay | undefined>()
  const keys = new WeakMap<LoadedOverlay, string | undefined>()
  const mounted = new Map<string, number>()
  const unsaved = new Map<string, ValidatedOverlay>()

  let teamOrder = initialTeamOrder
  let onError = initialOnError
  let status = loadingStatus
  let org: readonly unknown[] = []
  let team: readonly unknown[] = []
  let personal: readonly unknown[] = []
  let session: readonly unknown[] = []
  let previewed: object | null = null
  let pending: PendingVersion | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastTime = 0
  let mountedIds: readonly string[] = []
  let mountedScheduled = false
  let connection: object | undefined
  let version = 0
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

  function resolve(inputs: readonly unknown[]) {
    return resolveLayers(
      inputs.flatMap((input) => load(input) ?? []),
      { surface, baseIds: { ids: mountedIds, source: "mounted" }, teamOrder }
    )
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

  function mirror() {
    if (connection) {
      writeSession(surface, { overlays: session, preview: previewed })
    }
  }

  function persist() {
    for (const overlay of [...unsaved.values()]) {
      let saved: void | Promise<void>
      try {
        saved = storage.save(surface, overlay)
      } catch (error) {
        report(error)
        continue
      }
      unsaved.delete(overlay.id)
      if (saved instanceof Promise) {
        saved.catch((error: unknown) => {
          if (!unsaved.has(overlay.id)) {
            unsaved.set(overlay.id, overlay)
          }
          report(error)
        })
      }
    }
  }

  function flush() {
    clearTimeout(timer)
    timer = undefined
    if (pending) {
      unsaved.set(pending.overlay.id, pending.overlay)
      pending = undefined
    }
    persist()
  }

  function lowerOf(layer: "personal" | "session") {
    return layer === "personal"
      ? [...org, ...team, ...personal]
      : [...org, ...team, ...personal, ...session]
  }

  function notReady(): OverlayResult | undefined {
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
    if (mountedScheduled) {
      updateMountedIds()
    }
    const result = validateOverlay(input, {
      layers: {
        overlays: lowerOf(layer),
        surface,
        baseIds: { ids: mountedIds, source: "mounted" },
        teamOrder,
      },
    })
    return result.success
      ? { success: true, overlay: result.data }
      : { success: false, error: formatError(result.error) }
  }

  function replacedId(layer: "personal" | "session", key: string) {
    if (layer === "personal") {
      return pending?.key === key && now() - pending.at < coalesceWindow
        ? pending.overlay.id
        : undefined
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
    const time = tick()
    const candidate = {
      v: 1,
      id: generateId(time),
      surface,
      layer,
      ops: [...ops],
      basis: { contract: 1, core: __PLIANT_CORE_VERSION__, manifests: {} },
      source: "manual",
      ...(explain ? { explain: [...explain] } : {}),
      createdBy: "local",
      createdAt: new Date(time).toISOString(),
    }
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
      clearTimeout(timer)
      personal = [
        ...personal.filter((saved) => idOf(saved) !== overlay.id),
        overlay,
      ]
      pending = { overlay, key, at: now() }
      timer = setTimeout(flush, coalesceWindow)
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

  function withoutProperties(input: unknown, written: ReadonlySet<string>) {
    const overlay = load(input)
    if (!overlay) {
      return [input]
    }
    const keep = overlay.ops.map(
      (check) =>
        check.status !== "valid" ||
        !propertiesOf(check.op).some((property) => written.has(property))
    )
    if (keep.every(Boolean)) {
      return [input]
    }
    return keep.some(Boolean)
      ? [withOps(overlay, (index) => keep[index] === true)]
      : []
  }

  function lockIn(): OverlayResult {
    const rejected = notReady()
    if (rejected) {
      return rejected
    }
    const overlay = load(previewed)
    if (!overlay) {
      return { success: false, error: "There is no preview to lock in" }
    }
    const valid = overlay.ops.map((check) => check.status === "valid")
    const personalOnly = overlay.ops.map(
      (check) =>
        check.status === "valid" &&
        opCatalog[check.op.op].layers.includes("personal")
    )
    const time = tick()
    const createdAt = new Date(time).toISOString()
    let locked: ValidatedOverlay | undefined
    if (personalOnly.some(Boolean)) {
      const result = validate(
        {
          ...withOps(overlay, (index) => personalOnly[index] === true),
          id: generateId(time),
          layer: "personal",
          createdAt,
        },
        "personal"
      )
      if (!result.success) {
        return result
      }
      locked = result.overlay
    }
    const sessionOnly = (index: number) =>
      valid[index] === true && personalOnly[index] !== true
    const kept = valid.some((_, index) => sessionOnly(index))
      ? validate(
          {
            ...withOps(overlay, sessionOnly),
            id: generateId(time),
            layer: "session",
            createdAt,
          },
          "session"
        )
      : undefined
    if (kept && !kept.success) {
      return kept
    }
    const result: OverlayResult | undefined = locked
      ? { success: true, overlay: locked }
      : kept
    if (!result) {
      return { success: false, error: "The preview has no valid ops" }
    }
    if (locked) {
      flush()
      const written = new Set(locked.ops.flatMap((op) => propertiesOf(op)))
      session = session.flatMap((input) => withoutProperties(input, written))
      personal = [...personal, locked]
      unsaved.set(locked.id, locked)
      persist()
    }
    if (kept?.success) {
      session = [...session, kept.overlay]
    }
    previewed = null
    mirror()
    changeLayers()
    return result
  }

  function discard() {
    if (previewed !== null) {
      previewed = null
      mirror()
      changeLayers()
    }
  }

  function hydrate(token: object, stored: StoredLayers) {
    if (connection !== token) {
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
    const token = connection
    if (!token) {
      return
    }
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
          if (connection === token) {
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

  function updateMountedIds() {
    mountedScheduled = false
    const current = new Set(mountedIds)
    if (
      mounted.size !== current.size ||
      [...mounted.keys()].some((id) => !current.has(id))
    ) {
      mountedIds = [...mounted.keys()]
      changeLayers()
    }
  }

  function scheduleMountedIds() {
    if (!mountedScheduled) {
      mountedScheduled = true
      queueMicrotask(() => {
        if (mountedScheduled) {
          updateMountedIds()
        }
      })
    }
  }

  function registerNodes(ids: readonly string[]) {
    for (const id of ids) {
      mounted.set(id, (mounted.get(id) ?? 0) + 1)
    }
    scheduleMountedIds()
    let registered = true
    return () => {
      if (!registered) {
        return
      }
      registered = false
      for (const id of ids) {
        const count = mounted.get(id) ?? 0
        if (count > 1) {
          mounted.set(id, count - 1)
        } else {
          mounted.delete(id)
        }
      }
      scheduleMountedIds()
    }
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
      flush()
      window.removeEventListener("pagehide", flush)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }

  return {
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
    registerNodes,
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
  }
}
