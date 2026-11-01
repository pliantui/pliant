import * as z from "zod"

import { addressSchema } from "../address"
import { itemIdSchema } from "../identifier"

export const formOpSchemas = [
  z.object({
    op: z.literal("setDefault"),
    target: addressSchema,
    field: itemIdSchema,
    value: z.json(),
  }),
] as const
