import * as z from "zod"

import { functionNameSchema, itemIdSchema } from "./identifier"

export type Expression =
  | { field: string }
  | { value: string | number | boolean | null }
  | { ref: string }
  | { fn: string; args: Expression[] }

const maxDepth = 8
const maxArgs = 16
const maxNodes = 128

const leafSchemas = [
  z.strictObject({ field: itemIdSchema }),
  z.strictObject({
    value: z.union([z.string().max(200), z.number(), z.boolean(), z.null()]),
  }),
  z.strictObject({ ref: itemIdSchema }),
] as const

function expressionAtDepth(depth: number): z.ZodType<Expression, Expression> {
  if (depth === 0) {
    return z.union(leafSchemas)
  }
  return z.union([
    ...leafSchemas,
    z.strictObject({
      fn: functionNameSchema,
      args: z.array(expressionAtDepth(depth - 1)).max(maxArgs),
    }),
  ])
}

function countNodes(expression: Expression) {
  let count = 0
  const pending = [expression]
  for (let next = pending.pop(); next; next = pending.pop()) {
    count++
    if ("fn" in next) {
      pending.push(...next.args)
    }
  }
  return count
}

export const expressionSchema = expressionAtDepth(maxDepth).refine(
  (expression) => countNodes(expression) <= maxNodes,
  `Must have at most ${String(maxNodes)} nodes`
)
