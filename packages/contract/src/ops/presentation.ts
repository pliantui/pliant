import * as z from "zod"

import { addressSchema } from "../address"

export const presentationOpSchemas = [
  z.discriminatedUnion("as", [
    z.object({
      op: z.literal("setPresentation"),
      target: addressSchema,
      as: z.enum(["dialog", "page"]),
    }),
    z.object({
      op: z.literal("setPresentation"),
      target: addressSchema,
      as: z.enum(["sheet", "drawer"]),
      side: z.enum(["top", "right", "bottom", "left"]).optional(),
    }),
  ]),
  z.object({
    op: z.literal("setSize"),
    target: addressSchema,
    size: z.enum(["sm", "md", "lg", "xl", "full"]),
  }),
] as const
