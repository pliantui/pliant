import { expect } from "vitest"
import type * as z from "zod"

export function expectCrossFieldIssue(
  schema: z.ZodType,
  { value, message }: { value: unknown; message: string }
) {
  const result = schema.safeParse(value)
  expect(result.error?.issues.map((issue) => issue.message)).toEqual([message])
}
