import * as z from "zod"

import { itemIdSchema } from "./identifier"

const scalarSchema = z.union([z.string().max(200), z.number(), z.boolean()])

export const filterSchema = z.discriminatedUnion("operator", [
  z.object({
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
  z.object({
    field: itemIdSchema,
    operator: z.literal("in"),
    value: z.array(scalarSchema).min(1).max(100),
  }),
  z.object({
    field: itemIdSchema,
    operator: z.literal("between"),
    value: z.tuple([scalarSchema, scalarSchema]),
  }),
  z.object({
    field: itemIdSchema,
    operator: z.literal("isNull"),
  }),
  z.object({
    field: itemIdSchema,
    operator: z.literal("custom"),
    value: z.json(),
  }),
])

export type Filter = z.infer<typeof filterSchema>

export const sortSchema = z
  .array(
    z.object({
      field: itemIdSchema,
      dir: z.enum(["asc", "desc"]),
    })
  )
  .max(8)

export type Sort = z.infer<typeof sortSchema>
