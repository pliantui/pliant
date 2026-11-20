import * as z from "zod"

export type Result<T> =
  | { success: true; data: T; error?: never }
  | { success: false; error: z.ZodError; data?: never }

export interface Issue {
  readonly path: readonly PropertyKey[]
  readonly message: string
}

/** A failed result with a custom issue for each of `issues`. */
export function failure(issues: readonly Issue[]): Result<never> {
  return {
    success: false,
    error: new z.ZodError(
      issues.map(({ path, message }) => ({
        code: "custom",
        path: [...path],
        message,
      }))
    ),
  }
}
