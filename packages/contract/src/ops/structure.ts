import * as z from "zod"

import { itemAddressSchema, nodeAddressSchema } from "../address"
import {
  itemIdSchema,
  kebabIdSchema,
  registeredNameSchema,
} from "../identifier"
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
  move: z
    .strictObject({
      op: z.literal("move"),
      target: itemAddressSchema(),
      to: z.union([
        placementSchema,
        z.strictObject({ into: nodeAddressSchema({ template: false }) }),
      ]),
    })
    .superRefine((move, ctx) => {
      if ("into" in move.to && !/^[^[\]]*\/slots\/[^/]+$/.test(move.target)) {
        ctx.addIssue({
          code: "custom",
          path: ["target"],
          message: "Only a slot outside a template can move into another node",
        })
      }
    }),
  collapse: z.strictObject({
    op: z.literal("collapse"),
    target: nodeAddressSchema(),
    items: uniqueArray(itemIdSchema).min(1).max(32),
    into: z.enum(["more", "accordion", "tabs"]),
    label: labelSchema.optional(),
  }),
  pin: z.strictObject({
    op: z.literal("pin"),
    target: itemAddressSchema(),
    where: z.enum(["start", "end", "sticky", "none"]),
  }),
  setLayout: z.discriminatedUnion("mode", [
    z.strictObject({
      op: z.literal("setLayout"),
      target: nodeAddressSchema(),
      ...flowLayoutShape,
      at: breakpointSchema.optional(),
    }),
    z.strictObject({
      op: z.literal("setLayout"),
      target: nodeAddressSchema(),
      ...gridLayoutShape,
      at: breakpointSchema.optional(),
    }),
  ]),
  span: z.strictObject({
    op: z.literal("span"),
    target: itemAddressSchema(),
    columns: layoutColumnsSchema,
    at: breakpointSchema.optional(),
  }),
  insert: z.strictObject({
    op: z.literal("insert"),
    target: nodeAddressSchema({ template: false }),
    node: z.union([
      z.strictObject({
        id: kebabIdSchema,
        kind: z.enum(["chart", "stat"]),
        dataset: kebabIdSchema,
        label: labelSchema.optional(),
      }),
      z.strictObject({
        id: kebabIdSchema,
        kind: registeredNameSchema,
        dataset: kebabIdSchema.optional(),
        label: labelSchema.optional(),
      }),
    ]),
    at: placementSchema,
  }),
  wrap: z.discriminatedUnion("mode", [
    z.strictObject({
      op: z.literal("wrap"),
      target: nodeAddressSchema({ template: false }),
      id: kebabIdSchema,
      items: uniqueArray(itemIdSchema).min(2).max(12),
      ...flowLayoutShape,
    }),
    z.strictObject({
      op: z.literal("wrap"),
      target: nodeAddressSchema({ template: false }),
      id: kebabIdSchema,
      items: uniqueArray(itemIdSchema).min(2).max(12),
      ...gridLayoutShape,
    }),
  ]),
  remove: z.strictObject({
    op: z.literal("remove"),
    target: itemAddressSchema("slots"),
  }),
}
