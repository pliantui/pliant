import * as z from "zod"

import { addressSchema } from "../address"
import { valueSchema } from "../value"

export const formOpSchemas = {
  setDefault: z.strictObject({
    op: z.literal("setDefault"),
    target: addressSchema,
    value: valueSchema,
  }),
}
