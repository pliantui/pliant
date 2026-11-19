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

import { propertyKeysOf } from "./property-keys"
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
 * Changes the layers of the surface that the nearest `PliantRoot` holds.
 *
 * @experimental
 */
export interface PliantStore {
  /**
   * Applies ops as one overlay on the personal or session layer. The overlay
   * is validated against the layers below it and the mounted nodes, and
   * rejected as a whole when any op is invalid.
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
  /** Saves the preview as a new personal version and ends the preview. */
  readonly lockIn: () => OverlayResult
  /** Drops the preview. */
  readonly discard: () => void
}

export interface LayerStoreOptions {
  readonly surface: string
  readonly storage: StorageAdapter
  readonly teamOrder?: readonly string[] | undefined
  readonly now?: (() => number) | undefined
  readonly generateId?: ((time: number) => string) | undefined
}

export interface LayerStore {
  readonly actions: PliantStore
  readonly subscribe: (listener: () => void) => () => void
  readonly getResolved: () => ResolvedLayers
  readonly getServerResolved: () => ResolvedLayers
  readonly getPreview: () => LoadedOverlay | null
  readonly registerNodes: (ids: readonly string[]) => () => void
  readonly setTeamOrder: (teamOrder: readonly string[]) => void
  readonly connect: () => () => void
  readonly flush: () => void
}

interface PendingVersion {
  readonly overlay: ValidatedOverlay
  readonly keys: string | undefined
  readonly time: number
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

function reportError(error: unknown) {
  console.error(error)
}

export function createLayerStore({
  surface,
  storage,
  teamOrder: initialTeamOrder = [],
  now = Date.now,
  generateId = ulid,
}: LayerStoreOptions): LayerStore {
  const listeners = new Set<() => void>()
  const loaded = new WeakMap<object, LoadedOverlay | undefined>()
  const keysByOverlay = new WeakMap<LoadedOverlay, string | undefined>()
  const mounted = new Map<string, number>()

  let teamOrder = initialTeamOrder
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

  function keysOf(overlay: LoadedOverlay) {
    if (!keysByOverlay.has(overlay)) {
      keysByOverlay.set(overlay, propertyKeysOf(overlay, surface))
    }
    return keysByOverlay.get(overlay)
  }

  function resolve(inputs: readonly unknown[]) {
    return resolveLayers(
      inputs.flatMap((input) => load(input) ?? []),
      { surface, baseIds: { ids: mountedIds, source: "mounted" }, teamOrder }
    )
  }

  function emit() {
    version++
    for (const listener of listeners) {
      listener()
    }
  }

  // Strictly increasing, so a change never ties with an earlier one on
  // `createdAt`, and the preview always sorts last.
  function tick() {
    lastTime = Math.max(now(), lastTime + 1)
    return lastTime
  }

  function mirror() {
    if (connection) {
      writeSession(surface, { overlays: session, preview: previewed })
    }
  }

  function save(overlay: ValidatedOverlay) {
    try {
      void Promise.resolve(storage.save(surface, overlay)).catch(reportError)
    } catch (error) {
      reportError(error)
    }
  }

  function flush() {
    clearTimeout(timer)
    timer = undefined
    if (pending) {
      const { overlay } = pending
      pending = undefined
      save(overlay)
    }
  }

  function lowerOf(layer: "personal" | "session") {
    return layer === "personal"
      ? [...org, ...team, ...personal]
      : [...org, ...team, ...personal, ...session]
  }

  function validate(
    input: unknown,
    layer: "personal" | "session"
  ): OverlayResult {
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

  function replacedId(
    layer: "personal" | "session",
    keys: string,
    time: number
  ) {
    if (layer === "personal") {
      return pending?.keys === keys && time - pending.time < coalesceWindow
        ? pending.overlay.id
        : undefined
    }
    const replaced = session.find((input) => {
      const overlay = load(input)
      return overlay !== undefined && keysOf(overlay) === keys
    })
    return idOf(replaced)
  }

  function applyOps(
    layer: "personal" | "session",
    ops: readonly Op[],
    { explain }: ApplyOpsOptions = {}
  ): OverlayResult {
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
    const keys = loadedCandidate.success
      ? keysOf(loadedCandidate.data)
      : undefined
    const id = keys === undefined ? undefined : replacedId(layer, keys, time)
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
      pending = { overlay, keys, time }
      timer = setTimeout(flush, coalesceWindow)
    } else {
      session = [
        ...session.filter((saved) => idOf(saved) !== overlay.id),
        overlay,
      ]
      mirror()
    }
    emit()
    return result
  }

  function preview(input: unknown): OverlayResult {
    const time = tick()
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
      createdAt: new Date(time).toISOString(),
    }
    previewed = overlay
    mirror()
    emit()
    return { success: true, overlay }
  }

  function lockIn(): OverlayResult {
    if (previewed === null) {
      return { success: false, error: "There is no preview to lock in" }
    }
    flush()
    const time = tick()
    const result = validate(
      {
        ...previewed,
        id: generateId(time),
        layer: "personal",
        createdAt: new Date(time).toISOString(),
      },
      "personal"
    )
    if (!result.success) {
      return result
    }
    personal = [...personal, result.overlay]
    save(result.overlay)
    previewed = null
    mirror()
    emit()
    return result
  }

  function discard() {
    if (previewed !== null) {
      previewed = null
      mirror()
      emit()
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
      emit()
    }
  }

  function registerNodes(ids: readonly string[]) {
    for (const id of ids) {
      mounted.set(id, (mounted.get(id) ?? 0) + 1)
    }
    function schedule() {
      if (!mountedScheduled) {
        mountedScheduled = true
        queueMicrotask(updateMountedIds)
      }
    }
    schedule()
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
      schedule()
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
    mirror()

    function hydrate({
      org: savedOrg,
      team: savedTeam,
      personal: saved,
    }: StoredLayers) {
      if (connection === token) {
        org = savedOrg ?? []
        team = savedTeam ?? []
        personal = mergeById(saved ?? [], personal)
        emit()
      }
    }
    try {
      const stored = storage.load(surface)
      if (stored instanceof Promise) {
        stored.then(hydrate, reportError)
      } else {
        hydrate(stored)
      }
    } catch (error) {
      reportError(error)
    }
    emit()

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
    actions: { applyOps, preview, lockIn, discard },
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
    registerNodes,
    setTeamOrder(next) {
      if (JSON.stringify(next) !== JSON.stringify(teamOrder)) {
        teamOrder = next
        emit()
      }
    },
    connect,
    flush,
  }
}
