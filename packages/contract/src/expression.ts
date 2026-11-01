import * as z from "zod"

import { functionNameSchema, itemIdSchema } from "./identifier"

export type Expression =
  | { field: string }
  | { value: string | number | boolean | null }
  | { ref: string }
  | { fn: string; args: Expression[] }

const maxDepth = 6

const leafSchemas = [
  z.strictObject({ field: itemIdSchema }),
  z.strictObject({
    value: z.union([z.string().max(200), z.number(), z.boolean(), z.null()]),
  }),
  z.strictObject({ ref: itemIdSchema }),
] as const

function expressionAtDepth(depth: number): z.ZodType<Expression> {
  if (depth === 0) {
    return z.union(leafSchemas)
  }
  return z.union([
    ...leafSchemas,
    z.strictObject({
      fn: functionNameSchema,
      args: z.array(expressionAtDepth(depth - 1)).max(8),
    }),
  ])
}

export const expressionSchema = expressionAtDepth(maxDepth)
