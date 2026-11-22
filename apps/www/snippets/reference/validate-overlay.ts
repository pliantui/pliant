import { formatError, validateOverlay } from "@pliantui/core"

// #region validate
export async function POST(request: Request) {
  const result = validateOverlay(await request.json())
  if (!result.success) {
    return Response.json(
      { message: formatError(result.error) },
      { status: 400 }
    )
  }
  return Response.json(result.data)
}
// #endregion validate
