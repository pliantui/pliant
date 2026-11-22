// #region route
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

export { handler as GET, handler as PUT, handler as DELETE }
// #endregion route
