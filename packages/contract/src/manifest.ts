import * as z from "zod"

import { kindSchema, propNameSchema, propValueSchema } from "./identifier"
import { uniqueArray } from "./unique"

export const manifestPropSchema = z
  .strictObject({
    values: uniqueArray(propValueSchema).min(1).max(32),
    default: propValueSchema.optional(),
    semantic: uniqueArray(propValueSchema).max(32).optional(),
    description: z.string().max(200).optional(),
  })
  .superRefine((prop, ctx) => {
    if (prop.default !== undefined && !prop.values.includes(prop.default)) {
      ctx.addIssue({
        code: "custom",
        path: ["default"],
        message: "Must be one of values",
      })
    }
    for (const [index, value] of (prop.semantic ?? []).entries()) {
      if (!prop.values.includes(value)) {
        ctx.addIssue({
          code: "custom",
          path: ["semantic", index],
          message: "Must be one of values",
        })
      }
    }
  })

export type ManifestProp = z.infer<typeof manifestPropSchema>

export const manifestSchema = z
  .strictObject({
    kind: kindSchema,
    version: z.int().min(1),
    description: z.string().min(1).max(200),
    capabilities: z.strictObject({
      props: z.record(propNameSchema, manifestPropSchema).optional(),
      label: z.boolean().optional(),
      hideable: z.boolean().optional(),
      slots: z.boolean().optional(),
      layout: z.boolean().optional(),
      insertable: z.boolean().optional(),
      form: z.boolean().optional(),
      presentation: z.boolean().optional(),
      nav: z.boolean().optional(),
      actions: z.boolean().optional(),
      data: z.boolean().optional(),
    }),
  })
  .meta({
    title: "Pliant manifest",
    description: "What a component lets users change.",
  })

export type Manifest = z.infer<typeof manifestSchema>

export function defineManifest(manifest: z.input<typeof manifestSchema>) {
  return manifestSchema.parse(manifest)
}
