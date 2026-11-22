// Stands in for the app's own sign-in.
export function getSession(request: Request) {
  return Promise.resolve(
    request.headers.has("cookie")
      ? {
          userId: "user_123",
          orgId: "org_1",
          teamIds: ["finance"],
          role: "member",
        }
      : null
  )
}
