import * as z from "zod"

import { addressSchema } from "../address"

export const navOpSchemas = {
  setLanding: z.strictObject({
    op: z.literal("setLanding"),
    target: addressSchema,
  }),
}
