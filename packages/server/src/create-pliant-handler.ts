import type { LanguageModel } from "ai"

import { formatError } from "@pliantui/core"

import { answerAsk } from "./answer-ask"
import { askRequestSchema } from "./ask-request"
import type { AskResponse } from "./ask-response"
import { MissingRecordingError } from "./missing-recording-error"
import { isOutOfScope, outOfScopeMessage } from "./out-of-scope"
import { isJson, readBody } from "./read-body"
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

async function readJson(
  request: Request
): Promise<
  { success: true; data: unknown } | { success: false; response: Response }
> {
  // Requiring JSON keeps cross-site form posts, which skip the CORS preflight,
  // from spending a signed-in user's model budget.
  if (!isJson(request)) {
    return {
      success: false,
      response: error("The body must be application/json", 415),
    }
  }
  const text = await readBody(request, maxBodyBytes)
  if (text === undefined) {
    return { success: false, response: error("The request is too large", 413) }
  }
  try {
    return { success: true, data: JSON.parse(text) }
  } catch {
    return { success: false, response: error("The body must be JSON", 400) }
  }
}

function isAborted(request: Request) {
  return request.signal.aborted
}

// The AI SDK aborts a call that runs past `timeout` with a TimeoutError, which
// providers and retries may wrap.
function isTimeout(cause: unknown, depth = 0): boolean {
  if (!(cause instanceof Error) || depth > 3) {
    return false
  }
  if (cause.name === "TimeoutError") {
    return true
  }
  const lastError: unknown = "lastError" in cause ? cause.lastError : undefined
  return isTimeout(cause.cause, depth + 1) || isTimeout(lastError, depth + 1)
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
    if (request.signal.aborted) {
      return error("The request was aborted", 499)
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
      // The signal can abort while the model runs, after the check above.
      if (isAborted(request)) {
        throw cause
      }
      onError?.(cause)
      if (cause instanceof MissingRecordingError) {
        return error(cause.message, 500)
      }
      return isTimeout(cause)
        ? error("The model took too long to answer", 504)
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
