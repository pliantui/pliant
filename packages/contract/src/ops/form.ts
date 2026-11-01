import * as z from "zod"

import { itemAddressSchema } from "../address"
import { valueSchema } from "../value"

export const formOpSchemas = {
  setDefault: z.strictObject({
    op: z.literal("setDefault"),
    target: itemAddressSchema("fields"),
    value: valueSchema,
  }),
}
