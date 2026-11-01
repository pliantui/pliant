import * as z from "zod"

import { labelSchema } from "./label"
import { overlaySchema } from "./overlay"
import { surfaceSchema } from "./surface"
import { ulidSchema } from "./ulid"

export const savedViewSchema = z
  .looseObject({
    id: ulidSchema,
    name: labelSchema,
    surface: surfaceSchema,
    layer: z.enum(["org", "team", "personal"]),
    overlays: z.array(overlaySchema).max(50),
  })
  .superRefine((view, ctx) => {
    for (const [index, overlay] of view.overlays.entries()) {
      if (overlay.surface !== view.surface || overlay.layer !== view.layer) {
        ctx.addIssue({
          code: "custom",
          path: ["overlays", index],
          message: "Must have the view's surface and layer",
        })
      }
    }
  })

export type SavedView = z.infer<typeof savedViewSchema>
