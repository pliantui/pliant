import * as z from "zod"

export function uniqueArray<T extends z.ZodType>(item: T) {
  return z
    .array(item)
    .refine((items) => new Set(items).size === items.length, "Must be unique")
    .meta({ uniqueItems: true })
}
