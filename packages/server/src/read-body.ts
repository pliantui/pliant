async function readStream(body: ReadableStream<Uint8Array>, maxBytes: number) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let text = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      return text + decoder.decode()
    }
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      return undefined
    }
    text += decoder.decode(value, { stream: true })
  }
}

/**
 * Reads a request body as text, or returns `undefined` once it passes
 * `maxBytes`, whatever `Content-Length` claims.
 */
export async function readBody(request: Request, maxBytes: number) {
  const length = Number(request.headers.get("content-length") ?? 0)
  if (length > maxBytes) {
    return undefined
  }
  return request.body ? readStream(request.body, maxBytes) : ""
}

/** Whether the request says its body is JSON. */
export function isJson(request: Request) {
  return /^application\/json\s*(?:;|$)/i.test(
    request.headers.get("content-type") ?? ""
  )
}
