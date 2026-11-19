import * as z from "zod"

import { uniqueArray } from "./unique"
import { propValueSchema } from "./value"

const persist = z.boolean().optional()

/**
 * A default-state prop users may set per layer with `setDefault`. Values are
 * never free-form strings, so a default is never a data value.
 */
export const manifestDefaultSchema = z
  .union([
    z.strictObject({
      values: uniqueArray(propValueSchema).min(1).max(32),
      persist,
    }),
    z.strictObject({ type: z.literal("boolean"), persist }),
    z.strictObject({
      type: z.literal("number"),
      min: z.number(),
      max: z.number(),
      persist,
    }),
    z.strictObject({ type: z.literal("date"), persist }),
  ])
  .superRefine((declaration, ctx) => {
    if ("min" in declaration && declaration.min > declaration.max) {
      ctx.addIssue({
        code: "custom",
        path: ["max"],
        message: "Must be at least min",
      })
    }
  })

export type ManifestDefault = z.infer<typeof manifestDefaultSchema>
