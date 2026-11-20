import * as z from "zod"

import { addressSchema, itemAddressSchema, nodeAddressSchema } from "../address"
import { propNameSchema } from "../identifier"
import { propValueSchema, valueSchema } from "../value"

const fieldSchema = itemAddressSchema("fields")
const nodeSchema = nodeAddressSchema()
const defaultValueSchema = z.union([propValueSchema, z.number(), z.boolean()])

function addIssue(ctx: z.RefinementCtx, path: string, message: string) {
  ctx.addIssue({ code: "custom", path: [path], message })
}

export const formOpSchemas = {
  /**
   * Without `prop`, sets a form field's default, a data value. With `prop`,
   * sets one of a node's declared `defaults` to a string, number or boolean;
   * the declaration in the node's manifest decides which values fit.
   */
  setDefault: z
    .strictObject({
      op: z.literal("setDefault"),
      target: addressSchema,
      prop: propNameSchema.optional(),
      value: valueSchema,
    })
    .superRefine((op, ctx) => {
      if (op.prop === undefined) {
        if (!fieldSchema.safeParse(op.target).success) {
          addIssue(ctx, "target", "Must address a field")
        }
        return
      }
      if (!nodeSchema.safeParse(op.target).success) {
        addIssue(ctx, "target", "Must address a node")
      }
      if (!defaultValueSchema.safeParse(op.value).success) {
        addIssue(
          ctx,
          "value",
          "Must be a string of 1 to 64 characters, a number or a boolean"
        )
      }
    }),
}
