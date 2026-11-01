import * as z from "zod"

const decimalsSchema = z.int().min(0).max(10)

export const formatSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("number"),
    decimals: decimalsSchema.optional(),
    notation: z.enum(["standard", "compact"]).optional(),
    unit: z
      .string()
      .max(32)
      .regex(/^[a-z]+(?:-[a-z]+)*$/)
      .optional(),
  }),
  z.strictObject({
    type: z.literal("percent"),
    decimals: decimalsSchema.optional(),
  }),
  z.strictObject({
    type: z.literal("currency"),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    display: z.enum(["symbol", "narrowSymbol", "code", "name"]).optional(),
    decimals: decimalsSchema.optional(),
  }),
  z.strictObject({
    type: z.literal("date"),
    style: z.enum(["short", "medium", "long", "full", "relative"]),
    time: z.boolean().optional(),
  }),
])

export type Format = z.infer<typeof formatSchema>
