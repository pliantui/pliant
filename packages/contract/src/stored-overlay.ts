import * as z from "zod"

import { overlayObjectSchema } from "./overlay"
import { withoutReservedKeys } from "./reserved-keys"
import { textSchema } from "./text"
import { timestampSchema } from "./timestamp"

const storedOverlayObjectSchema = z
  .looseObject({
    overlay: overlayObjectSchema,
    etag: textSchema(256, { min: 1 }).meta({
      description: "Opaque: compare it only for equality.",
    }),
    version: z.int().min(1).meta({
      description:
        "The adapter increases it on every save. For a team or org overlay it is the version that basis.layers records, and clients compare versions to tell that a layer changed.",
    }),
    updatedAt: timestampSchema,
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
