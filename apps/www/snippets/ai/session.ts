// Stands in for the app's own sign-in.
export function getSessionUser(request: Request) {
  return request.headers.has("cookie")
    ? { id: "user_123", orgId: "org_1", role: "sales" as const }
    : null
}
