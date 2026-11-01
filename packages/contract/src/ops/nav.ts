import * as z from "zod"

import { addressSchema } from "../address"

export const navOpSchemas = [
  z.object({
    op: z.literal("setLanding"),
    target: addressSchema,
    href: z.string().min(1).max(2048),
  }),
] as const
