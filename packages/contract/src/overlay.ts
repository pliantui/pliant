import * as z from "zod"

import { kebabIdSchema, kindSchema } from "./identifier"
import { layerSchema, type Layer } from "./layer"
import { opCatalog } from "./op-catalog"
import { surfaceSchema } from "./surface"
import { ulidSchema } from "./ulid"

const referenceSchema = z.string().min(1).max(256)

const layerVersionSchema = z.looseObject({
  id: referenceSchema,
  version: z.int().min(1),
})

export const overlayOpSchema = z.looseObject({
  op: z
    .string()
    .max(64)
    .regex(/^[a-z][A-Za-z0-9]*$/, "Must be an op name"),
  target: z
    .string()
    .max(256)
    .regex(
      /^(?:[a-z][A-Za-z0-9_\-[\]/]*|@[a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/,
      "Must be an address or a reserved target such as @app"
    ),
})

export type OverlayOp = z.infer<typeof overlayOpSchema>

function isKnownOp(op: string): op is keyof typeof opCatalog {
  return Object.hasOwn(opCatalog, op)
}

const semverPattern =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

const overlayShape = {
  v: z.literal(1),
  id: ulidSchema,
  surface: surfaceSchema,
  ops: z.array(overlayOpSchema).min(1).max(500),
  basis: z.looseObject({
    contract: z.literal(1),
    core: z.string().max(64).regex(semverPattern, "Must be a semver version"),
    manifests: z.record(kindSchema, z.int().min(1)),
    datasets: z.record(kebabIdSchema, z.int().min(1)).optional(),
    layers: z
      .looseObject({
        org: layerVersionSchema.optional(),
        team: layerVersionSchema.optional(),
      })
      .optional(),
  }),
  source: z.enum(["ai", "manual", "chip", "share", "promote"]),
  explain: z.array(z.string().min(1).max(200)).max(500).optional(),
  createdBy: referenceSchema,
  createdAt: z.iso.datetime({ offset: true }),
}

export const overlaySchema = z
  .discriminatedUnion("layer", [
    z.looseObject({
      ...overlayShape,
      layer: z.literal("org"),
      scope: z.looseObject({ org: referenceSchema }),
    }),
    z.looseObject({
      ...overlayShape,
      layer: z.literal("team"),
      scope: z.looseObject({
        team: referenceSchema,
        org: referenceSchema.optional(),
      }),
    }),
    z.looseObject({
      ...overlayShape,
      layer: z.enum(["personal", "session"]),
      scope: z.never().optional(),
    }),
  ])
  .superRefine((overlay, ctx) => {
    if (overlay.explain && overlay.explain.length !== overlay.ops.length) {
      ctx.addIssue({
        code: "custom",
        path: ["explain"],
        message: "Must have one sentence per op",
      })
    }
    for (const [index, { op, target }] of overlay.ops.entries()) {
      const layers: readonly Layer[] = isKnownOp(op)
        ? opCatalog[op].layers
        : layerSchema.options
      if (!layers.includes(overlay.layer)) {
        ctx.addIssue({
          code: "custom",
          path: ["ops", index, "op"],
          message: `${op} isn't allowed in the ${overlay.layer} layer`,
        })
      }
      if ((target === "@app") !== (overlay.surface === "@app")) {
        ctx.addIssue({
          code: "custom",
          path: ["ops", index, "target"],
          message: "Ops target @app exactly when the overlay's surface is @app",
        })
      }
    }
  })
  .meta({
    title: "Pliant overlay",
    description: "A set of ops one layer applies to a surface.",
  })

export type Overlay = z.infer<typeof overlaySchema>
