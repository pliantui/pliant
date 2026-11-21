import { storedOverlaySchema, type StoredOverlay } from "@pliantui/contract"

import type { StorageAdapter, StoredLayers } from "./storage-adapter"
import { StorageConflictError } from "./storage-conflict-error"

// Browsers refuse a `keepalive` request whose body passes 64 KiB, so a
// larger save goes out without it.
const keepaliveBytes = 65_536

/** @experimental */
export interface ServerAdapterOptions {
  /**
   * The URL of the route that serves `createStorageHandler` from
   * `@pliantui/server/storage`, such as `"/api/pliant/storage"`.
   */
  endpoint: string
  /**
   * The `fetch` that sends each request, such as one that adds an
   * authorization header. Defaults to the global `fetch`.
   */
  fetch?: typeof fetch
}

function recordsOf(value: unknown): StoredOverlay[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const record = storedOverlaySchema.safeParse(item)
        return record.success ? [record.data] : []
      })
    : []
}

async function failure(response: Response) {
  const body: unknown = await response.json().catch(() => undefined)
  const message =
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
      ? body.message
      : response.statusText
  return new Error(
    `Storage answered ${String(response.status)}${message ? `: ${message}` : ""}`
  )
}

async function conflict(response: Response) {
  const body: unknown = await response.json().catch(() => undefined)
  const current =
    typeof body === "object" && body !== null && "current" in body
      ? body.current
      : undefined
  if (current === null) {
    return new StorageConflictError(undefined)
  }
  const record = storedOverlaySchema.safeParse(current)
  return record.success
    ? new StorageConflictError(record.data)
    : new Error("Storage answered 412 without the current record")
}

/**
 * Stores overlays through the app's own server, in a route that serves
 * `createStorageHandler` from `@pliantui/server/storage`. The server
 * decides which org, team and personal overlays the user reads and
 * writes, and assigns every etag, version and timestamp.
 *
 * Requests go to `endpoint` with the query string `surface`, `id`,
 * `history` or `layer`, and send the browser's cookies for the same
 * origin. Saves send `If-Match` or `If-None-Match: *`, and an HTTP 412
 * rejects with a `StorageConflictError` that carries the current record.
 *
 * It has no `subscribe`, because the handler doesn't push changes: a
 * surface reloads when it mounts. To reload on changes from other tabs or
 * devices, add a `subscribe` that listens to your own channel:
 * `{ ...serverAdapter(options), subscribe }`.
 *
 * @experimental
 */
export function serverAdapter({
  endpoint,
  fetch: send = (input, init) => fetch(input, init),
}: ServerAdapterOptions): StorageAdapter {
  function url(params: Record<string, string>) {
    return `${endpoint}${endpoint.includes("?") ? "&" : "?"}${new URLSearchParams(params).toString()}`
  }

  async function get(params: Record<string, string>) {
    const response = await send(url(params), { cache: "no-store" })
    if (!response.ok) {
      throw await failure(response)
    }
    const body: unknown = await response.json()
    return typeof body === "object" && body !== null ? body : {}
  }

  return {
    async load(surface): Promise<StoredLayers> {
      const body = await get({ surface })
      return {
        org: recordsOf("org" in body ? body.org : undefined),
        team: recordsOf("team" in body ? body.team : undefined),
        personal: recordsOf("personal" in body ? body.personal : undefined),
      }
    },
    async save(surface, overlay, { ifMatch }) {
      const body = new TextEncoder().encode(JSON.stringify(overlay))
      const response = await send(url({ surface }), {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          ...(ifMatch === null
            ? { "if-none-match": "*" }
            : { "if-match": `"${ifMatch}"` }),
        },
        body,
        keepalive: body.byteLength < keepaliveBytes,
      })
      if (response.status === 412) {
        throw await conflict(response)
      }
      if (!response.ok) {
        throw await failure(response)
      }
      const record = storedOverlaySchema.safeParse(await response.json())
      if (!record.success) {
        throw new Error("Storage answered without the stored record")
      }
      return record.data
    },
    async remove(surface, id, { ifMatch }) {
      const response = await send(url({ surface, id }), {
        method: "DELETE",
        headers: { "if-match": `"${ifMatch}"` },
        keepalive: true,
      })
      if (response.status === 412) {
        throw await conflict(response)
      }
      if (!response.ok) {
        throw await failure(response)
      }
    },
    async list(layer) {
      const body = await get({ layer })
      return recordsOf("records" in body ? body.records : undefined)
    },
    async history(surface, id) {
      const body = await get({
        surface,
        history: "",
        ...(id !== undefined && { id }),
      })
      return recordsOf("records" in body ? body.records : undefined)
    },
  }
}
