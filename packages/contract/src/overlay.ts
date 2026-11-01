import * as z from "zod"

import { kebabIdSchema } from "./identifier"
import { layerSchema } from "./layer"
import { surfaceSchema } from "./surface"

export const ulidSchema = z
  .string()
  .regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/, "Must be a ULID")

const referenceSchema = z.string().min(1).max(256)

const layerVersionSchema = z.object({
  id: referenceSchema,
  version: z.int().min(1),
})

export const overlaySchema = z.object({
  v: z.literal(1),
  id: ulidSchema,
  surface: surfaceSchema,
  layer: layerSchema,
  scope: z
    .object({
      team: referenceSchema.optional(),
      org: referenceSchema.optional(),
    })
    .optional(),
  ops: z
    .array(
      z.looseObject({
        op: z.string().min(1).max(64),
        target: z.string().min(1).max(256),
      })
    )
    .min(1)
    .max(50),
  basis: z.object({
    contract: z.literal(1),
    core: z
      .string()
      .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, "Must be a semver version"),
    manifests: z.record(kebabIdSchema, z.int().min(1)),
    datasets: z.record(kebabIdSchema, z.int().min(1)).optional(),
    layers: z
      .object({
        org: layerVersionSchema.optional(),
        team: layerVersionSchema.optional(),
      })
      .optional(),
  }),
  source: z.enum(["ai", "manual", "chip", "share", "promote"]),
  explain: z.array(z.string().min(1).max(200)).max(50).optional(),
  createdBy: referenceSchema,
  createdAt: z.iso.datetime({ offset: true }),
})

export type Overlay = z.infer<typeof overlaySchema>
