import { expect } from "vitest"
import type * as z from "zod"

export function expectCrossFieldIssue(
  schema: z.ZodType,
  {
    value,
    message,
    path,
  }: { value: unknown; message: string; path: (string | number)[] }
) {
  const result = schema.safeParse(value)
  expect(
    result.error?.issues.map((issue) => ({
      message: issue.message,
      path: issue.path,
    }))
  ).toEqual([{ message, path }])
}
