import * as z from "zod"

import { itemIdSchema } from "./identifier"
import { scalarSchema, valueSchema } from "./value"

export const filterSchema = z.discriminatedUnion("operator", [
  z.strictObject({
    field: itemIdSchema,
    operator: z.enum([
      "eq",
      "neq",
      "contains",
      "startsWith",
      "gt",
      "gte",
      "lt",
      "lte",
    ]),
    value: scalarSchema,
  }),
  z.strictObject({
    field: itemIdSchema,
    operator: z.literal("in"),
    value: z.array(scalarSchema).min(1).max(100),
  }),
  z.strictObject({
    field: itemIdSchema,
    operator: z.literal("between"),
    value: z.tuple([scalarSchema, scalarSchema]),
  }),
  z.strictObject({
    field: itemIdSchema,
    operator: z.literal("isNull"),
  }),
  z.strictObject({
    field: itemIdSchema,
    operator: z.literal("custom"),
    value: valueSchema,
  }),
])

export type Filter = z.infer<typeof filterSchema>
