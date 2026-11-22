// #region route
import { drizzleOverlayStore } from "@pliantui/server/drizzle"
import { createStorageHandler } from "@pliantui/server/storage"

import { db } from "./db"
import { getSession } from "./session"

const handler = createStorageHandler({
  store: drizzleOverlayStore(db),
  getUser: async (request) => {
    const session = await getSession(request)
    return (
      session && {
        id: session.userId,
        org: session.orgId,
        teams: session.teamIds,
        role: session.role,
      }
    )
  },
  canPublish: (user, target) =>
    target.layer === "team" ? user.role === "lead" : user.role === "admin",
})

export { handler as GET, handler as PUT, handler as DELETE }
// #endregion route
