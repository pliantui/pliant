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

export async function PUT(request: Request) {
  const result = validateOverlay(await request.clone().json())
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
