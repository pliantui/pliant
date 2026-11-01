import * as z from "zod"

import { itemAddressSchema } from "../address"

export const navOpSchemas = {
  setLanding: z.strictObject({
    op: z.literal("setLanding"),
    target: itemAddressSchema("items"),
  }),
}
