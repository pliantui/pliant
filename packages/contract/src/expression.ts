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

function argsOf(value: unknown): unknown[] {
  if (
    typeof value === "object" &&
    value !== null &&
    "args" in value &&
    Array.isArray(value.args)
  ) {
    return value.args
  }
  return []
}

function isWithinNodeLimit(expression: unknown) {
  let count = 0
  const pending = [expression]
  while (pending.length > 0) {
    const args = argsOf(pending.pop())
    count++
    if (count > maxNodes || args.length > maxArgs) {
      return false
    }
    pending.push(...args)
  }
  return true
}

export const expressionSchema = z.preprocess<
  unknown,
  z.ZodType<Expression, Expression>,
  Expression
>((expression, ctx) => {
  if (!isWithinNodeLimit(expression)) {
    ctx.addIssue({
      code: "custom",
      input: expression,
      continue: false,
      message: `Must have at most ${String(maxNodes)} nodes and ${String(maxArgs)} arguments per function`,
    })
    return z.NEVER
  }
  return expression
}, expressionAtDepth(maxDepth))
