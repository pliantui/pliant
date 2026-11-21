import {
  overlaySchema,
  surfaceSchema,
  type Overlay,
  type StoredOverlay,
} from "@pliantui/contract"
import { formatError } from "@pliantui/core"

import { byTime } from "./by-time"
import { isTooDeep } from "./json-depth"
import type { OverlayKey, OverlayScope, OverlayStore } from "./overlay-store"
import { isJson, readBody } from "./read-body"
import { ulid } from "./ulid"

const maxBodyBytes = 262_144
const ulidPattern = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/
const etagPattern = /^\s*"([\x21\x23-\x7e]{1,256})"\s*$/
const maxDepth = 64
const layers = ["org", "team", "personal"] as const

/**
 * The team or org layer a user publishes to, with the org resolved: a team
 * overlay without `scope.org` belongs to the user's org.
 *
 * @experimental
 */
export type PublishTarget =
  | { readonly layer: "team"; readonly org: string; readonly team: string }
  | { readonly layer: "org"; readonly org: string }

/**
 * The signed-in user, as `getUser` returns it: their id, the org they
 * belong to and the teams of that org they are a member of. Team overlays
 * need the org: a user without one reads and writes no team overlays. It
 * may carry anything else `canPublish` needs, such as roles.
 *
 * @experimental
 */
export interface StorageUser {
  readonly id: string
  readonly org?: string | undefined
  readonly teams?: readonly string[] | undefined
}

/** @experimental */
export interface StorageHandlerConfig<User extends StorageUser = StorageUser> {
  /** Where the overlays are kept, such as `memoryOverlayStore()`. */
  store: OverlayStore
  /**
   * Returns the signed-in user, or `null` to answer 401. The user reads
   * their own personal overlays, their teams' overlays and their org's.
   */
  getUser: (request: Request) => User | null | Promise<User | null>
  /**
   * Whether the user may save and remove overlays in this team or org
   * layer. It is only asked about a team of the user's org that the user is
   * a member of, or about the user's own org. Without it, nobody can.
   */
  canPublish?: (user: User, target: PublishTarget) => boolean | Promise<boolean>
  /** The clock used for `updatedAt` and etags. Defaults to the system clock. */
  now?: () => Date
  /** Called with the errors the response hides, so they can be logged. */
  onError?: (error: unknown) => void
}

class HttpError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function respond(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", ...headers },
  })
}

function noContent() {
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  })
}

function conflict(current: StoredOverlay | undefined) {
  return respond({ current: current ?? null }, 412)
}

// A surface's records include the `@app` ones, which apply on every surface.
function surfacesOf(surface: string) {
  return surface === "@app" ? [surface] : [surface, "@app"]
}

function readSurface(params: URLSearchParams) {
  const surface = surfaceSchema.safeParse(params.get("surface"))
  if (!surface.success) {
    throw new HttpError("surface must be a surface", 400)
  }
  return surface.data
}

function readId(params: URLSearchParams) {
  const id = params.get("id")
  if (id === null) {
    return undefined
  }
  if (!ulidPattern.test(id)) {
    throw new HttpError("id must be an overlay id", 400)
  }
  return id
}

function readEtag(value: string) {
  const etag = etagPattern.exec(value)?.[1]
  if (etag === undefined) {
    throw new HttpError("If-Match must be a single quoted etag", 400)
  }
  return etag
}

function readIfMatch(request: Request) {
  const ifMatch = request.headers.get("if-match")
  if (ifMatch === null) {
    throw new HttpError("Send If-Match", 428)
  }
  return readEtag(ifMatch)
}

// `null` asks to create the record: `If-None-Match: *`.
function readSavePrecondition(request: Request) {
  const ifNoneMatch = request.headers.get("if-none-match")
  if (ifNoneMatch === null) {
    if (!request.headers.has("if-match")) {
      throw new HttpError("Send If-Match or If-None-Match: *", 428)
    }
    return readIfMatch(request)
  }
  if (request.headers.has("if-match") || ifNoneMatch.trim() !== "*") {
    throw new HttpError("Send either If-Match or If-None-Match: *", 400)
  }
  return null
}

function teamScope(org: string, team: string) {
  return JSON.stringify([org, team])
}

function readableScopes(user: StorageUser) {
  const scopes: OverlayScope[] = [{ layer: "personal", scope: user.id }]
  if (user.org !== undefined) {
    for (const team of user.teams ?? []) {
      scopes.push({ layer: "team", scope: teamScope(user.org, team) })
    }
    scopes.push({ layer: "org", scope: user.org })
  }
  return scopes
}

// The key the overlay is stored under, or `undefined` when the user can't
// read it.
function keyOf(user: StorageUser, overlay: Overlay): OverlayKey | undefined {
  const { surface, id } = overlay
  switch (overlay.layer) {
    case "personal":
      return { surface, layer: "personal", scope: user.id, id }
    case "team": {
      // A team overlay without `scope.org` belongs to the user's org.
      const { team, org = user.org } = overlay.scope
      return org !== undefined && org === user.org && user.teams?.includes(team)
        ? { surface, layer: "team", scope: teamScope(org, team), id }
        : undefined
    }
    case "org":
      return overlay.scope.org === user.org
        ? { surface, layer: "org", scope: overlay.scope.org, id }
        : undefined
    case "session":
      return undefined
  }
}

function targetOf(
  user: StorageUser,
  overlay: Overlay
): PublishTarget | undefined {
  switch (overlay.layer) {
    case "team": {
      const { team, org = user.org } = overlay.scope
      return org === undefined ? undefined : { layer: "team", org, team }
    }
    case "org":
      return { layer: "org", org: overlay.scope.org }
    default:
      return undefined
  }
}

async function readOverlay(request: Request) {
  if (!isJson(request)) {
    throw new HttpError("The body must be application/json", 415)
  }
  const text = await readBody(request, maxBodyBytes)
  if (text === undefined) {
    throw new HttpError("The request is too large", 413)
  }
  if (isTooDeep(text, maxDepth)) {
    throw new HttpError(
      `The body must not nest more than ${String(maxDepth)} levels deep`,
      400
    )
  }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw new HttpError("The body must be JSON", 400)
  }
  const overlay = overlaySchema.safeParse(body)
  if (!overlay.success) {
    throw new HttpError(formatError(overlay.error), 400)
  }
  return overlay.data
}

/**
 * Creates a route handler that stores overlays for `serverAdapter` from
 * `@pliantui/react/server-adapter`. Each user reads their own personal
 * overlays, their teams' and their org's, and saves to a team or org layer
 * only when `canPublish` allows it. The handler validates every overlay
 * and assigns every etag, version and timestamp itself. An overlay's
 * `createdBy` comes from the client and is stored as sent; the store's
 * `by` is the trusted author. The handler has no quota or rate limit, so
 * add your own. It uses only Web
 * APIs, so it works anywhere a Web `Request` handler does:
 *
 * ```ts
 * const handler = createStorageHandler({
 *   store: memoryOverlayStore(),
 *   getUser: async (request) => {
 *     const session = await auth(request)
 *     return (
 *       session && {
 *         id: session.userId,
 *         org: session.orgId,
 *         teams: session.teamIds,
 *       }
 *     )
 *   },
 * })
 *
 * export { handler as GET, handler as PUT, handler as DELETE }
 * ```
 *
 * @experimental The request and response shapes may change in any release.
 */
export function createStorageHandler<User extends StorageUser>(
  config: StorageHandlerConfig<User>
) {
  const {
    store,
    getUser,
    canPublish = () => false,
    now = () => new Date(),
    onError,
  } = config

  async function assertCanWrite(user: User, overlay: Overlay) {
    if (overlay.layer === "personal") {
      return
    }
    const target = targetOf(user, overlay)
    if (!target || !(await canPublish(user, target))) {
      throw new HttpError(`You can't publish to this ${overlay.layer}`, 403)
    }
  }

  function nextRecord(
    overlay: Overlay,
    previous: StoredOverlay | undefined,
    removed = false
  ): StoredOverlay {
    const time = now()
    const updatedAt = time.toISOString()
    return {
      overlay,
      etag: ulid(time.getTime()),
      version: (previous?.version ?? 0) + 1,
      updatedAt,
      ...(removed && { deletedAt: updatedAt }),
    }
  }

  async function read(user: User, params: URLSearchParams) {
    const scopes = readableScopes(user)
    const layer = params.get("layer")
    if (layer !== null) {
      if (
        params.has("surface") ||
        params.has("history") ||
        !layers.some((name) => name === layer)
      ) {
        throw new HttpError("layer must be org, team or personal", 400)
      }
      const records = await store.list({
        scopes: scopes.filter((scope) => scope.layer === layer),
      })
      return respond({
        records: records.filter((record) => keyOf(user, record.overlay)),
      })
    }
    const surfaces = surfacesOf(readSurface(params))
    if (params.has("history")) {
      const query = { scopes, surfaces, id: readId(params) }
      const records = store.history
        ? (await store.history(query)).map((version) => version.record)
        : [...(await store.list(query))].sort(byTime)
      return respond({
        records: records.filter((record) => keyOf(user, record.overlay)),
      })
    }
    const live = (await store.list({ scopes, surfaces })).filter(
      (record) => !record.deletedAt && keyOf(user, record.overlay)
    )
    return respond(
      Object.fromEntries(
        layers.map((name) => [
          name,
          live.filter((record) => record.overlay.layer === name),
        ])
      )
    )
  }

  async function save(user: User, request: Request, params: URLSearchParams) {
    const surface = readSurface(params)
    const ifMatch = readSavePrecondition(request)
    const overlay = await readOverlay(request)
    if (overlay.surface !== surface && overlay.surface !== "@app") {
      throw new HttpError("The overlay is for another surface", 400)
    }
    if (overlay.layer === "session") {
      throw new HttpError("Session overlays aren't stored", 400)
    }
    const key = keyOf(user, overlay)
    if (!key) {
      throw new HttpError(`You aren't a member of this ${overlay.layer}`, 403)
    }
    await assertCanWrite(user, overlay)
    const current = await store.get(key)
    if (current?.deletedAt) {
      return conflict(current)
    }
    const record = nextRecord(overlay, current)
    if (!(await store.put(key, record, ifMatch, { by: user.id }))) {
      return conflict(await store.get(key))
    }
    return respond(record, ifMatch === null ? 201 : 200, {
      etag: `"${record.etag}"`,
    })
  }

  async function remove(user: User, request: Request, params: URLSearchParams) {
    const surfaces = surfacesOf(readSurface(params))
    const id = readId(params)
    if (id === undefined) {
      throw new HttpError("id must be an overlay id", 400)
    }
    const ifMatch = readIfMatch(request)
    const entries = (
      await store.list({ scopes: readableScopes(user), surfaces, id })
    ).flatMap((record) => {
      const key = keyOf(user, record.overlay)
      return key ? [{ record, key }] : []
    })
    const target = entries.find(({ record }) => record.etag === ifMatch)
    if (!target) {
      const live = entries.find(({ record }) => !record.deletedAt)
      return live ? conflict(live.record) : noContent()
    }
    const { record, key } = target
    if (record.deletedAt) {
      return noContent()
    }
    await assertCanWrite(user, record.overlay)
    const tombstone = nextRecord(record.overlay, record, true)
    if (!(await store.put(key, tombstone, ifMatch, { by: user.id }))) {
      const current = await store.get(key)
      return current?.deletedAt ? noContent() : conflict(current)
    }
    return noContent()
  }

  return async function handler(request: Request): Promise<Response> {
    const method = request.method
    if (method !== "GET" && method !== "PUT" && method !== "DELETE") {
      return respond({ message: "Use GET, PUT or DELETE" }, 405, {
        allow: "GET, PUT, DELETE",
      })
    }
    try {
      const user = await getUser(request)
      if (user === null) {
        return respond({ message: "Sign in to use storage" }, 401)
      }
      const { searchParams } = new URL(request.url)
      return method === "GET"
        ? await read(user, searchParams)
        : method === "PUT"
          ? await save(user, request, searchParams)
          : await remove(user, request, searchParams)
    } catch (cause) {
      if (cause instanceof HttpError) {
        return respond({ message: cause.message }, cause.status)
      }
      onError?.(cause)
      return respond({ message: "Couldn't reach storage" }, 500)
    }
  }
}
