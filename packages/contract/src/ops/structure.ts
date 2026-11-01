import * as z from "zod"

import { addressSchema } from "../address"
import { itemIdSchema, kebabIdSchema, kindSchema } from "../identifier"
import { labelSchema } from "../label"
import {
  breakpointSchema,
  layoutAlignSchema,
  layoutColumnsSchema,
} from "../layout"
import { uniqueArray } from "../unique"

const placementSchema = z.union([
  z.strictObject({ before: itemIdSchema }),
  z.strictObject({ after: itemIdSchema }),
  z.strictObject({ index: z.int().min(0) }),
])

const flowLayoutShape = {
  mode: z.enum(["stack", "row"]),
  align: layoutAlignSchema.optional(),
}

const gridLayoutShape = {
  mode: z.literal("grid"),
  columns: layoutColumnsSchema.optional(),
  align: layoutAlignSchema.optional(),
}

export const structureOpSchemas = {
  move: z.strictObject({
    op: z.literal("move"),
    target: addressSchema,
    to: z.union([placementSchema, z.strictObject({ into: addressSchema })]),
  }),
  collapse: z.strictObject({
    op: z.literal("collapse"),
    target: addressSchema,
    items: uniqueArray(itemIdSchema).min(1).max(32),
    into: z.enum(["more", "accordion", "tabs"]),
    label: labelSchema.optional(),
  }),
  pin: z.strictObject({
    op: z.literal("pin"),
    target: addressSchema,
    where: z.enum(["start", "end", "sticky", "none"]),
  }),
  setLayout: z.discriminatedUnion("mode", [
    z.strictObject({
      op: z.literal("setLayout"),
      target: addressSchema,
      ...flowLayoutShape,
      at: breakpointSchema.optional(),
    }),
    z.strictObject({
      op: z.literal("setLayout"),
      target: addressSchema,
      ...gridLayoutShape,
      at: breakpointSchema.optional(),
    }),
  ]),
  span: z.strictObject({
    op: z.literal("span"),
    target: addressSchema,
    columns: layoutColumnsSchema,
    at: breakpointSchema.optional(),
  }),
  insert: z.strictObject({
    op: z.literal("insert"),
    target: addressSchema,
    node: z.strictObject({
      id: kebabIdSchema,
      kind: kindSchema,
      label: labelSchema.optional(),
      source: addressSchema.optional(),
    }),
    at: placementSchema,
  }),
  wrap: z.discriminatedUnion("mode", [
    z.strictObject({
      op: z.literal("wrap"),
      target: addressSchema,
      id: kebabIdSchema,
      items: uniqueArray(itemIdSchema).min(2).max(12),
      ...flowLayoutShape,
    }),
    z.strictObject({
      op: z.literal("wrap"),
      target: addressSchema,
      id: kebabIdSchema,
      items: uniqueArray(itemIdSchema).min(2).max(12),
      ...gridLayoutShape,
    }),
  ]),
  remove: z.strictObject({
    op: z.literal("remove"),
    target: addressSchema,
  }),
}
