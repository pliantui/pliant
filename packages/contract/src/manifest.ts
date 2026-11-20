import * as z from "zod"

import {
  idPatterns,
  kindSchema,
  propNameSchema,
  registeredNameSchema,
} from "./identifier"
import { manifestDefaultSchema } from "./manifest-default"
import { withoutReservedKeys } from "./reserved-keys"
import { textSchema } from "./text"
import { uniqueArray } from "./unique"
import { propValueSchema } from "./value"

export const manifestPropSchema = z
  .strictObject({
    values: uniqueArray(propValueSchema).min(1).max(32),
    default: propValueSchema.optional(),
    semantic: uniqueArray(propValueSchema).max(32).optional(),
    description: textSchema(200).optional(),
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

const builtInCapabilities = {
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
  defaults: z.record(propNameSchema, manifestDefaultSchema).optional(),
}

// Namespaced capabilities hold any JSON value, kept but not read, so a
// manifest written for an extension still loads where it isn't installed.
// Any other unknown key is rejected, so a typo like `hidable` stays an error.
const capabilitiesSchema = z
  .object(builtInCapabilities)
  .catchall(z.unknown())
  .superRefine((capabilities, ctx) => {
    const keys = Object.keys(capabilities).filter(
      (key) =>
        !Object.hasOwn(builtInCapabilities, key) &&
        !registeredNameSchema.safeParse(key).success
    )
    if (keys.length > 0) {
      ctx.addIssue({ code: "unrecognized_keys", keys, input: capabilities })
    }
  })
  .meta({
    patternProperties: { [`^${idPatterns.namespaced}$`]: {} },
    propertyNames: { not: { pattern: "^pliant:" } },
    additionalProperties: false,
  })

const manifestObjectSchema = z
  .strictObject({
    kind: kindSchema,
    version: z.int().min(1),
    description: textSchema(200, { min: 1 }),
    capabilities: capabilitiesSchema,
  })
  .meta({
    title: "Pliant manifest",
    description: "What a component lets users change.",
  })

export const manifestSchema = withoutReservedKeys(manifestObjectSchema)

export type Manifest = z.infer<typeof manifestSchema>

export function defineManifest(manifest: z.input<typeof manifestSchema>) {
  return manifestSchema.parse(manifest)
}
