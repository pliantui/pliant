import * as z from "zod"

import { kindSchema } from "./identifier"
import { surfaceSchema } from "./surface"
import { ulidSchema } from "./ulid"

const referenceSchema = z.string().min(1).max(256)

const layerVersionSchema = z.strictObject({
  id: referenceSchema,
  version: z.int().min(1),
})

export const overlayOpSchema = z.looseObject({
  op: z
    .string()
    .max(64)
    .regex(/^[a-z][A-Za-z0-9]*$/, "Must be an op name"),
  target: z.union([
    z
      .string()
      .max(256)
      .regex(/^[a-z]/, "Must be an address"),
    z.enum(["@surface", "@app"]),
  ]),
})

export type OverlayOp = z.infer<typeof overlayOpSchema>

const overlayShape = {
  v: z.literal(1),
  id: ulidSchema,
  surface: surfaceSchema,
  ops: z.array(overlayOpSchema).min(1).max(500),
  basis: z.object({
    contract: z.literal(1),
    core: z
      .string()
      .regex(
        /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
        "Must be a semver version"
      ),
    manifests: z.record(kindSchema, z.int().min(1)),
    datasets: z.record(kindSchema, z.int().min(1)).optional(),
    layers: z
      .object({
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
    z.object({
      ...overlayShape,
      layer: z.literal("org"),
      scope: z.strictObject({ org: referenceSchema }),
    }),
    z.object({
      ...overlayShape,
      layer: z.literal("team"),
      scope: z.strictObject({
        team: referenceSchema,
        org: referenceSchema.optional(),
      }),
    }),
    z.object({
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
      if (op === "setPage" && overlay.layer !== "session") {
        ctx.addIssue({
          code: "custom",
          path: ["ops", index, "op"],
          message: "setPage is only allowed in the session layer",
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
