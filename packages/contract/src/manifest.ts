import * as z from "zod"

import { kebabIdSchema, propNameSchema } from "./identifier"

const propValueSchema = z.string().min(1).max(64)

export const manifestPropSchema = z.object({
  values: z.array(propValueSchema).min(1).max(32),
  default: propValueSchema.optional(),
  semantic: z.array(propValueSchema).max(32).optional(),
  description: z.string().max(200).optional(),
})

export const manifestSchema = z.object({
  kind: kebabIdSchema,
  version: z.int().min(1),
  description: z.string().min(1).max(200),
  capabilities: z.object({
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

export type Manifest = z.infer<typeof manifestSchema>

export function defineManifest(manifest: z.input<typeof manifestSchema>) {
  return manifestSchema.parse(manifest)
}
