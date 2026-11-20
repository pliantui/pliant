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
const builtInCapabilitiesSchema = z.object(builtInCapabilities)

type NamespacedCapabilities = Record<`${string}:${string}`, unknown>

const capabilitiesSchema = builtInCapabilitiesSchema
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
    propertyNames: {
      maxLength: registeredNameSchema.maxLength,
      not: { pattern: "^pliant:" },
    },
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

// The schema's own types allow any capability key; these allow only the
// built-in ones and namespaced ones, so a typo is a type error.
export type Manifest = Omit<z.output<typeof manifestSchema>, "capabilities"> & {
  capabilities: z.output<typeof builtInCapabilitiesSchema> &
    NamespacedCapabilities
}

type ManifestInput = Omit<z.input<typeof manifestSchema>, "capabilities"> & {
  capabilities: z.input<typeof builtInCapabilitiesSchema> &
    NamespacedCapabilities
}

export function defineManifest(manifest: ManifestInput): Manifest {
  return manifestSchema.parse(manifest)
}
