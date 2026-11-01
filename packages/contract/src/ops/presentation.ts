import * as z from "zod"

import { addressSchema } from "../address"

export const presentationOpSchemas = {
  setPresentation: z.discriminatedUnion("as", [
    z.strictObject({
      op: z.literal("setPresentation"),
      target: addressSchema,
      as: z.enum(["dialog", "page"]),
    }),
    z.strictObject({
      op: z.literal("setPresentation"),
      target: addressSchema,
      as: z.enum(["sheet", "drawer"]),
      side: z.enum(["top", "right", "bottom", "left"]).optional(),
    }),
  ]),
  setSize: z.strictObject({
    op: z.literal("setSize"),
    target: addressSchema,
    size: z.enum(["sm", "md", "lg", "xl", "full"]),
  }),
}
