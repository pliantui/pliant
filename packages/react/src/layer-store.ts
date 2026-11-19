import * as z from "zod"

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

import { changeKeyOf, dependsOnHistory, propertiesOf } from "./property-keys"
import { differingProperties, viewOf } from "./resolved-view"
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

/**
 * What `lockIn` saved: the personal version, or `null` when no op could be
 * saved there, and the ops kept in the session layer instead.
 *
 * @experimental
 */
export type LockInResult =
  | {
      readonly success: true
      readonly overlay: ValidatedOverlay | null
      readonly keptInSession: readonly Op[]
    }
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
   * `createdAt` always sorts after every loaded personal and session
   * overlay. So a saved overlay dated in the future, from a clock that ran
   * ahead, moves every later `createdAt` past its date for good.
   *
   * The overlay is validated against the layers below it and the mounted
   * nodes, and rejected as a whole when any op is invalid. It is also
   * rejected until the layers are `ready` (see `usePliantStatus`), rather
   * than validated against layers that haven't loaded.
   *
   * A personal change that writes exactly the properties of the previous
   * one, within 1s of it, replaces it, so dragging a column width saves one
   * version. Changes that place, insert or remove an item (such as `move`,
   * `pin` or `remove`) are never replaced, since resolution keeps their
   * history. Personal changes are saved after 1s without another one, and
   * when the page is hidden or unloads. A session change replaces the
   * session overlay that wrote exactly the same properties, with the same
   * exception.
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
   * saved at once. Session changes to the same whole-value properties
   * (such as `visible`, `width` or `sort`) are dropped, so they can't hide
   * it.
   *
   * Some ops stay in the session layer instead, as a new session overlay
   * above the others, and are listed in `keptInSession`:
   * - ops allowed only in the session layer, such as `setPage`;
   * - ops that share a property with a session placement, insertion or
   *   removal, which are never dropped, since resolution keeps their history
   *   (later anchors on a moved item still use its old place);
   * - ops that don't validate as a personal version;
   * - every op, when the rest wouldn't validate above the locked version;
   * - ops whose move would change the resolved view (each property's
   *   winning op, each placement, and each op that doesn't apply), such as a
   *   move into a node a session `wrap` creates;
   * - with each of these, every op that shares a property with it.
   *
   * The resolved view is the same before and after. `overlay` is `null` when
   * every op stays in the session layer.
   */
  readonly lockIn: () => LockInResult
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
  /** Whether changes replace earlier ones; off only to test that it's exact. */
  readonly coalesce?: boolean | undefined
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
  coalesce = true,
}: LayerStoreOptions): LayerStore {
  const listeners = new Set<() => void>()
  const loaded = new WeakMap<object, LoadedOverlay | undefined>()
  const keys = new WeakMap<LoadedOverlay, string | undefined>()
  const mounted = new Map<string, number>()
  const unsaved = new Map<string, ValidatedOverlay>()
  const failures = new Map<string, string>()

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
  let currentLoad: object | undefined
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

  // A version is retried on every flush, but the same failure (such as
  // newer data that will never be overwritten) is reported once until the
  // version saves or fails differently.
  function saveFailed(overlay: ValidatedOverlay, error: unknown) {
    if (!unsaved.has(overlay.id)) {
      unsaved.set(overlay.id, overlay)
    }
    const key =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    if (failures.get(overlay.id) !== key) {
      failures.set(overlay.id, key)
      report(error)
    }
  }

  function persist() {
    for (const overlay of [...unsaved.values()]) {
      let saved: void | Promise<void>
      try {
        saved = storage.save(surface, overlay)
      } catch (error) {
        saveFailed(overlay, error)
        continue
      }
      unsaved.delete(overlay.id)
      if (saved instanceof Promise) {
        saved.then(
          () => {
            failures.delete(overlay.id)
          },
          (error: unknown) => {
            saveFailed(overlay, error)
          }
        )
      } else {
        failures.delete(overlay.id)
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
    if (!coalesce) {
      return undefined
    }
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

  // The session ops that write a property in `written` are dropped, so a
  // locked version isn't hidden by them; `dropped` lists their properties.
  function withoutProperties(
    inputs: readonly unknown[],
    written: ReadonlySet<string>
  ) {
    const dropped: (readonly string[])[] = []
    const kept = inputs.flatMap((input) => {
      const overlay = load(input)
      if (!overlay) {
        return [input]
      }
      const keep = overlay.ops.map((check) => {
        if (check.status !== "valid") {
          return true
        }
        const properties = propertiesOf(check.op)
        if (properties.some((property) => written.has(property))) {
          dropped.push(properties)
          return false
        }
        return true
      })
      if (keep.every(Boolean)) {
        return [input]
      }
      return keep.some(Boolean)
        ? [withOps(overlay, (index) => keep[index] === true)]
        : []
    })
    return { kept, dropped }
  }

  function lockIn(): LockInResult {
    const rejected = notReady()
    if (rejected) {
      return rejected
    }
    const loadedPreview = load(previewed)
    if (!loadedPreview) {
      return { success: false, error: "There is no preview to lock in" }
    }
    const overlay: LoadedOverlay = loadedPreview
    const target = viewOf(getResolved())
    const valid = new Map(
      overlay.ops.flatMap((check) =>
        check.status === "valid" ? [[check.index, check.op] as const] : []
      )
    )
    const propertiesByIndex = new Map(
      [...valid].map(([index, op]) => [index, propertiesOf(op)] as const)
    )
    const time = tick()
    const createdAt = new Date(time).toISOString()
    const lockedId = generateId(time)
    const keptId = generateId(time)

    // Validates the preview's ops at `indices` as one overlay of `layer`,
    // with issues pointing at the preview's own ops.
    function check(
      indices: readonly number[],
      layer: "personal" | "session",
      lower: readonly unknown[]
    ) {
      const result = validateOverlay(
        {
          ...withOps(overlay, (index) => indices.includes(index)),
          id: layer === "personal" ? lockedId : keptId,
          layer,
          createdAt,
        },
        {
          layers: {
            overlays: lower,
            surface,
            baseIds: { ids: mountedIds, source: "mounted" },
            teamOrder,
          },
        }
      )
      if (result.success) {
        return { success: true as const, overlay: result.data }
      }
      const failing = new Set<number>()
      const issues = result.error.issues.map((issue) => {
        const [first, position, ...rest] = issue.path
        const index =
          first === "ops" && typeof position === "number"
            ? indices[position]
            : undefined
        if (index === undefined) {
          return issue
        }
        failing.add(index)
        return { ...issue, path: ["ops", index, ...rest] }
      })
      return {
        success: false as const,
        failing,
        error: formatError(new z.ZodError(issues)),
      }
    }

    // Moving an op back also moves every locked op that shares a property
    // with it, transitively, so a chain of such ops moves in one round.
    function withoutConnected(
      toPersonal: ReadonlySet<number>,
      moving: Iterable<number>
    ) {
      const remaining = new Set(toPersonal)
      const moved = new Set<number>()
      const queue = [...moving]
      for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
        if (moved.has(next)) {
          continue
        }
        moved.add(next)
        remaining.delete(next)
        const properties = propertiesByIndex.get(next) ?? []
        for (const index of remaining) {
          if (
            propertiesByIndex
              .get(index)
              ?.some((property) => properties.includes(property))
          ) {
            queue.push(index)
          }
        }
      }
      return remaining
    }

    // Session ops whose effect depends on history are never dropped, so a
    // locked op sharing a property with one stays in the session layer.
    const protectedProperties = new Set(
      session.flatMap(
        (input) =>
          load(input)?.ops.flatMap((check) =>
            check.status === "valid" && dependsOnHistory(check.op)
              ? propertiesOf(check.op)
              : []
          ) ?? []
      )
    )
    let toPersonal = withoutConnected(
      new Set(
        [...valid].flatMap(([index, op]) =>
          opCatalog[op.op].layers.includes("personal") ? [index] : []
        )
      ),
      [...valid].flatMap(([index, op]) =>
        !opCatalog[op.op].layers.includes("personal") ||
        propertiesOf(op).some((property) => protectedProperties.has(property))
          ? [index]
          : []
      )
    )

    // Each round compares what the user would see with what they see now,
    // and moves the locked ops involved in a difference (writing a differing
    // property, or having dropped a session op that writes one) back to the
    // session layer, all of them when none is found. Every round moves at
    // least one op, and with none left the preview is a session overlay
    // above every other one, as it was.
    for (;;) {
      const personalIndices = [...valid.keys()].filter((index) =>
        toPersonal.has(index)
      )
      const sessionIndices = [...valid.keys()].filter(
        (index) => !toPersonal.has(index)
      )
      const locked =
        personalIndices.length > 0
          ? check(personalIndices, "personal", lowerOf("personal"))
          : undefined
      if (locked && !locked.success) {
        toPersonal = withoutConnected(
          toPersonal,
          locked.failing.size > 0 ? locked.failing : toPersonal
        )
        continue
      }
      const { kept: trimmed, dropped } = withoutProperties(
        session,
        new Set(locked?.overlay.ops.flatMap((op) => propertiesOf(op)))
      )
      const kept =
        sessionIndices.length > 0
          ? check(sessionIndices, "session", [
              ...lowerOf("personal"),
              ...(locked ? [locked.overlay] : []),
              ...trimmed,
            ])
          : undefined
      if (kept && !kept.success) {
        if (locked) {
          toPersonal = new Set()
          continue
        }
        return { success: false, error: kept.error }
      }
      const nextSession = [...trimmed, ...(kept ? [kept.overlay] : [])]
      if (locked) {
        const differing = differingProperties(
          target,
          viewOf(
            resolve([
              ...org,
              ...team,
              ...personal,
              locked.overlay,
              ...nextSession,
            ])
          )
        )
        if (differing.size > 0) {
          const touched = dropped.filter((properties) =>
            properties.some((property) => differing.has(property))
          )
          const involved = personalIndices.filter((index) =>
            (propertiesByIndex.get(index) ?? []).some(
              (property) =>
                differing.has(property) ||
                touched.some((properties) => properties.includes(property))
            )
          )
          toPersonal = withoutConnected(
            toPersonal,
            involved.length > 0 ? involved : personalIndices
          )
          continue
        }
      }
      if (!locked && !kept) {
        return { success: false, error: "The preview has no valid ops" }
      }
      flush()
      if (locked) {
        personal = [...personal, locked.overlay]
        unsaved.set(locked.overlay.id, locked.overlay)
        persist()
      }
      session = nextSession
      previewed = null
      mirror()
      changeLayers()
      return {
        success: true,
        overlay: locked?.overlay ?? null,
        keptInSession: kept?.overlay.ops ?? [],
      }
    }
  }

  function discard() {
    if (previewed !== null) {
      previewed = null
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
      currentLoad = undefined
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
