// #region route
import { formatError, validateOverlay } from "@pliantui/core"
import {
  createStorageHandler,
  memoryOverlayStore,
} from "@pliantui/server/storage"

import { getSession } from "./session"

const handler = createStorageHandler({
  store: memoryOverlayStore(),
  getUser: async (request) => {
    const session = await getSession(request)
    return (
      session && {
        id: session.userId,
        org: session.orgId,
        teams: session.teamIds,
      }
    )
  },
})

// The handler caps bodies at 256 KB, but this route parses the body first,
// so it checks the declared length before reading it.
const maxBodyBytes = 262_144

export async function PUT(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ message: "The body must be JSON" }, { status: 415 })
  }
  const length = Number(request.headers.get("content-length"))
  if (!(length > 0 && length <= maxBodyBytes)) {
    return Response.json(
      { message: "The body must declare a length of at most 256 KB" },
      { status: 413 }
    )
  }
  let body: unknown
  try {
    body = await request.clone().json()
  } catch {
    return Response.json({ message: "The body must be JSON" }, { status: 400 })
  }
  const result = validateOverlay(body)
  if (!result.success) {
    return Response.json(
      { message: formatError(result.error) },
      { status: 400 }
    )
  }
  return handler(request)
}

export { handler as GET, handler as DELETE }
// #endregion route
