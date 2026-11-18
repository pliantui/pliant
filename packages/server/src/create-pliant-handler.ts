import type { LanguageModel } from "ai"

import { formatError } from "@pliantui/core"

import { answerAsk } from "./answer-ask"
import { askRequestSchema } from "./ask-request"
import type { AskResponse } from "./ask-response"
import { MissingRecordingError } from "./missing-recording-error"
import { isOutOfScope, outOfScopeMessage } from "./out-of-scope"
import { ulid } from "./ulid"

declare const __PLIANT_CORE_VERSION__: string

const maxBodyBytes = 32_768

/** @experimental */
export interface PliantHandlerConfig {
  /** Any AI SDK language model, for example `anthropic("claude-haiku-5-5")`. */
  model: Exclude<LanguageModel, string>
  /**
   * Returns the id of the signed-in user, or `null` to answer 401. To allow
   * anonymous asks, return a fixed id such as `"anonymous"`, and add rate
   * limits before exposing the endpoint.
   */
  getUser: (request: Request) => string | null | Promise<string | null>
  /** Most tool calls the model may make in one answer. Defaults to 8. */
  maxToolCalls?: number
  /** Milliseconds allowed for each model call. Defaults to 15000. */
  timeout?: number
  /** The clock used for `createdAt`. Defaults to the system clock. */
  now?: () => Date
  /** Generates overlay ids, which must be ULIDs. */
  generateId?: () => string
  /**
   * Called with the errors the response hides, such as provider and network
   * errors, so they can be logged.
   */
  onError?: (error: unknown) => void
}

function respond(body: AskResponse, status = 200) {
  return Response.json(body, { status })
}

function error(message: string, status: number) {
  return respond({ status: "error", message }, status)
}

async function readBody(body: ReadableStream<Uint8Array>) {
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
    if (size > maxBodyBytes) {
      await reader.cancel()
      return undefined
    }
    text += decoder.decode(value, { stream: true })
  }
}

async function readJson(
  request: Request
): Promise<
  { success: true; data: unknown } | { success: false; response: Response }
> {
  // Requiring JSON keeps cross-site form posts, which skip the CORS preflight,
  // from spending a signed-in user's model budget.
  const type = request.headers.get("content-type") ?? ""
  if (!/^application\/json\s*(?:;|$)/i.test(type)) {
    return {
      success: false,
      response: error("The body must be application/json", 415),
    }
  }
  const length = Number(request.headers.get("content-length") ?? 0)
  const text =
    length > maxBodyBytes
      ? undefined
      : request.body
        ? await readBody(request.body)
        : ""
  if (text === undefined) {
    return { success: false, response: error("The request is too large", 413) }
  }
  try {
    return { success: true, data: JSON.parse(text) }
  } catch {
    return { success: false, response: error("The body must be JSON", 400) }
  }
}

/**
 * Creates a route handler that answers asks: it validates the request, turns
 * the ask into ops with the configured model, validates them as a
 * session-layer overlay and returns it for preview. It uses only Web APIs, so
 * it works anywhere a Web `Request` handler does, such as a Next.js route on
 * the Node.js or edge runtime:
 *
 * ```ts
 * export const POST = createPliantHandler({
 *   model: anthropic("claude-haiku-5-5"),
 *   getUser: async (request) => (await auth(request))?.userId ?? null,
 * })
 * ```
 *
 * @experimental The request and response shapes may change in any release.
 */
export function createPliantHandler(config: PliantHandlerConfig) {
  const {
    getUser,
    maxToolCalls = 8,
    timeout = 15_000,
    now = () => new Date(),
    generateId = () => ulid(now().getTime()),
    onError,
  } = config
  const { model } = config

  async function answer(request: Request, user: string): Promise<Response> {
    const body = await readJson(request)
    if (!body.success) {
      return body.response
    }
    const ask = askRequestSchema.safeParse(body.data)
    if (!ask.success) {
      return error(formatError(ask.error), 400)
    }
    if (isOutOfScope(ask.data.prompt, ask.data.context)) {
      return respond({ status: "unavailable", reason: outOfScopeMessage })
    }
    try {
      const result = await answerAsk(ask.data, {
        model,
        user,
        coreVersion: __PLIANT_CORE_VERSION__,
        now,
        generateId,
        maxToolCalls,
        timeout,
        signal: request.signal,
      })
      return respond(result, result.status === "error" ? 422 : 200)
    } catch (cause) {
      if (request.signal.aborted) {
        throw cause
      }
      onError?.(cause)
      return cause instanceof MissingRecordingError
        ? error(cause.message, 500)
        : error("The model couldn't answer this ask", 502)
    }
  }

  return async function handler(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return error("Use POST", 405)
    }
    try {
      const user = await getUser(request)
      return user === null
        ? error("Sign in to ask", 401)
        : await answer(request, user)
    } catch (cause) {
      if (request.signal.aborted) {
        return error("The request was aborted", 499)
      }
      onError?.(cause)
      return error("Couldn't answer this ask", 500)
    }
  }
}
