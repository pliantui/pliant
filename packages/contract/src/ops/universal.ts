import * as z from "zod"

import { addressSchema } from "../address"
import { labelSchema, propNameSchema } from "../identifier"

export const universalOpSchemas = [
  z.object({
    op: z.literal("setProp"),
    target: addressSchema,
    prop: propNameSchema,
    value: z.string().max(64),
  }),
  z.object({
    op: z.literal("rename"),
    target: addressSchema,
    label: labelSchema,
  }),
  z.object({
    op: z.literal("hide"),
    target: addressSchema,
  }),
  z.object({
    op: z.literal("show"),
    target: addressSchema,
  }),
] as const
