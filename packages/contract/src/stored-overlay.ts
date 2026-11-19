import * as z from "zod"

import { overlayObjectSchema } from "./overlay"
import { withoutReservedKeys } from "./reserved-keys"
import { textSchema } from "./text"

const storedOverlayObjectSchema = z
  .looseObject({
    overlay: overlayObjectSchema,
    etag: textSchema(256, { min: 1 }).meta({
      description:
        "Opaque: compare it only for equality, as a conditional save does.",
    }),
    version: z.int().min(1).meta({
      description:
        "The overlay's version, as basis.layers records it. Compare versions, not etags, to tell whether a layer changed.",
    }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .meta({
    title: "Pliant stored overlay",
    description:
      "An overlay as a storage adapter stores and returns it. Validate the overlay as the @pliantui/contract README describes.",
  })

export const storedOverlaySchema = withoutReservedKeys(
  storedOverlayObjectSchema
)

export type StoredOverlay = z.infer<typeof storedOverlaySchema>
