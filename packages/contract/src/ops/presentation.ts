import * as z from "zod"

import { nodeAddressSchema } from "../address"

export const presentationOpSchemas = {
  setPresentation: z.discriminatedUnion("as", [
    z.strictObject({
      op: z.literal("setPresentation"),
      target: nodeAddressSchema(),
      as: z.enum(["dialog", "page"]),
    }),
    z.strictObject({
      op: z.literal("setPresentation"),
      target: nodeAddressSchema(),
      as: z.enum(["sheet", "drawer"]),
      side: z.enum(["top", "right", "bottom", "left"]).optional(),
    }),
  ]),
  setSize: z.strictObject({
    op: z.literal("setSize"),
    target: nodeAddressSchema(),
    size: z.enum(["sm", "md", "lg", "xl", "full"]),
  }),
}
