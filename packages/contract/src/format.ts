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
  /**
   * Currency values are IEEE 754 doubles, always rounded for display to the
   * currency's minor units (2 for USD, 0 for JPY) unless `decimals` is set.
   */
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
