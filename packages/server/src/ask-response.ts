import * as z from "zod"

import { overlaySchema } from "@pliantui/contract"

/**
 * The answer to an ask. `ok` carries a session-layer overlay to preview and
 * one sentence per op; nothing is saved until the user keeps it.
 *
 * @experimental
 */
export const askResponseSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("ok"),
    overlay: overlaySchema,
    explain: z.array(z.string().min(1).max(200)).min(1),
  }),
  z.strictObject({
    status: z.literal("clarify"),
    question: z.string().min(1).max(200),
  }),
  z.strictObject({
    status: z.literal("unavailable"),
    reason: z.string().min(1),
  }),
  z.strictObject({
    status: z.literal("error"),
    message: z.string().min(1),
  }),
])

/** @experimental */
export type AskResponse = z.infer<typeof askResponseSchema>
