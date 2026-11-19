import * as z from "zod"

import { uniqueArray } from "./unique"
import { propValueSchema } from "./value"

const persist = z.boolean().optional()

/**
 * A default-state prop users may set per layer with `setDefault`: an enum of
 * all-string or all-number `values`, a boolean, a number from `min` to `max`,
 * or an ISO calendar date. Values are never free-form strings, so a default is
 * never a data value. With `persist: true`, the user's own changes to the prop
 * are saved to their personal layer automatically.
 */
export const manifestDefaultSchema = z
  .union([
    z.strictObject({
      values: z.union([
        uniqueArray(propValueSchema).min(1).max(32),
        uniqueArray(z.number()).min(1).max(32),
      ]),
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
