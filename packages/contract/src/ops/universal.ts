import * as z from "zod"

import { addressSchema } from "../address"
import { propNameSchema } from "../identifier"
import { labelSchema } from "../label"

export const universalOpSchemas = {
  setProp: z.strictObject({
    op: z.literal("setProp"),
    target: addressSchema,
    prop: propNameSchema,
    value: z.string().min(1).max(64),
  }),
  rename: z.strictObject({
    op: z.literal("rename"),
    target: addressSchema,
    label: labelSchema,
  }),
  hide: z.strictObject({
    op: z.literal("hide"),
    target: addressSchema,
  }),
  show: z.strictObject({
    op: z.literal("show"),
    target: addressSchema,
  }),
}
