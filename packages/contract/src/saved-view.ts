import * as z from "zod"

import { labelSchema } from "./label"
import { layerSchema } from "./layer"
import { overlaySchema } from "./overlay"
import { surfaceSchema } from "./surface"
import { ulidSchema } from "./ulid"

export const savedViewSchema = z.object({
  id: ulidSchema,
  name: labelSchema,
  surface: surfaceSchema,
  layer: layerSchema,
  overlays: z.array(overlaySchema).max(50),
})

export type SavedView = z.infer<typeof savedViewSchema>
