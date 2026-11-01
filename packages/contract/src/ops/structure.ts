import * as z from "zod"

import { addressSchema } from "../address"
import {
  itemIdSchema,
  kebabIdSchema,
  labelSchema,
  registeredNameSchema,
} from "../identifier"
import {
  breakpointSchema,
  layoutAlignSchema,
  layoutColumnsSchema,
  layoutModeSchema,
} from "../layout"

const placementSchema = z.union([
  z.strictObject({ before: itemIdSchema }),
  z.strictObject({ after: itemIdSchema }),
  z.strictObject({ index: z.int().min(0) }),
])

export const structureOpSchemas = [
  z.object({
    op: z.literal("move"),
    target: addressSchema,
    to: z.union([placementSchema, z.strictObject({ into: addressSchema })]),
  }),
  z.object({
    op: z.literal("collapse"),
    target: addressSchema,
    items: z.array(itemIdSchema).min(1).max(32),
    into: z.enum(["more", "accordion", "tabs"]),
    label: labelSchema.optional(),
  }),
  z.object({
    op: z.literal("pin"),
    target: addressSchema,
    where: z.enum(["start", "end", "sticky", "none"]),
  }),
  z.object({
    op: z.literal("setLayout"),
    target: addressSchema,
    mode: layoutModeSchema,
    columns: layoutColumnsSchema.optional(),
    align: layoutAlignSchema.optional(),
    at: breakpointSchema.optional(),
  }),
  z.object({
    op: z.literal("span"),
    target: addressSchema,
    cols: layoutColumnsSchema,
    at: breakpointSchema.optional(),
  }),
  z.object({
    op: z.literal("insert"),
    target: addressSchema,
    node: z.object({
      id: kebabIdSchema,
      kind: z.union([z.enum(["chart", "stat"]), registeredNameSchema]),
      label: labelSchema.optional(),
    }),
    at: placementSchema,
  }),
  z.object({
    op: z.literal("wrap"),
    target: addressSchema,
    id: kebabIdSchema,
    items: z.array(itemIdSchema).min(2).max(12),
    mode: layoutModeSchema,
    columns: layoutColumnsSchema.optional(),
    align: layoutAlignSchema.optional(),
  }),
  z.object({
    op: z.literal("remove"),
    target: addressSchema,
  }),
] as const
