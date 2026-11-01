import * as z from "zod"

import { labelSchema } from "./identifier"
import { layerSchema } from "./layer"
import { overlaySchema, ulidSchema } from "./overlay"
import { surfaceSchema } from "./surface"

export const savedViewSchema = z.object({
  id: ulidSchema,
  name: labelSchema,
  surface: surfaceSchema,
  layer: layerSchema,
  overlays: z.array(overlaySchema).max(50),
})

export type SavedView = z.infer<typeof savedViewSchema>
