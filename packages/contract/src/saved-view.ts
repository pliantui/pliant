import * as z from "zod"

import { labelSchema } from "./label"
import { overlaySchema } from "./overlay"
import { surfaceSchema } from "./surface"
import { ulidSchema } from "./ulid"

export const savedViewSchema = z
  .looseObject({
    v: z.literal(1),
    id: ulidSchema,
    name: labelSchema,
    surface: surfaceSchema,
    layer: z.enum(["org", "team", "personal"]),
    overlays: z.array(overlaySchema).max(50),
  })
  .superRefine((view, ctx) => {
    const ids = new Set<string>()
    const [first] = view.overlays
    for (const [index, overlay] of view.overlays.entries()) {
      if (overlay.surface !== view.surface || overlay.layer !== view.layer) {
        ctx.addIssue({
          code: "custom",
          path: ["overlays", index],
          message: "Must have the view's surface and layer",
        })
      }
      if (
        overlay.scope?.team !== first?.scope?.team ||
        overlay.scope?.org !== first?.scope?.org
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["overlays", index, "scope"],
          message: "Must have the same scope as the view's other overlays",
        })
      }
      if (ids.has(overlay.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["overlays", index, "id"],
          message: "Must be unique within the view",
        })
      }
      ids.add(overlay.id)
    }
  })
  .meta({
    title: "Pliant saved view",
    description: "A named set of overlays for one surface.",
  })

export type SavedView = z.infer<typeof savedViewSchema>
