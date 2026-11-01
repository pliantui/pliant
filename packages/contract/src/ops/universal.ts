import * as z from "zod"

import { addressSchema } from "../address"
import { propNameSchema } from "../identifier"
import { labelSchema } from "../label"
import { propValueSchema } from "../value"

export const universalOpSchemas = {
  setProp: z.strictObject({
    op: z.literal("setProp"),
    target: addressSchema,
    prop: propNameSchema,
    value: propValueSchema,
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
