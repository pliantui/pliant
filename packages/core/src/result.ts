import type * as z from "zod"

export type Result<T> =
  | { success: true; data: T; error?: never }
  | { success: false; error: z.ZodError; data?: never }
