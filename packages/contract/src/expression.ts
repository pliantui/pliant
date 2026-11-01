import * as z from "zod"

import { functionNameSchema, itemIdSchema } from "./identifier"

export type Expression =
  | { field: string }
  | { value: string | number | boolean | null }
  | { ref: string }
  | { fn: string; args: Expression[] }

export const expressionSchema: z.ZodType<Expression> = z.union([
  z.strictObject({ field: itemIdSchema }),
  z.strictObject({
    value: z.union([z.string().max(200), z.number(), z.boolean(), z.null()]),
  }),
  z.strictObject({ ref: itemIdSchema }),
  z.strictObject({
    fn: functionNameSchema,
    get args() {
      return z.array(expressionSchema).max(8)
    },
  }),
])
