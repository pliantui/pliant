import * as z from "zod"

import { idPatterns } from "./identifier"

export const collectionSchema = z.enum([
  "columns",
  "fields",
  "items",
  "actions",
  "slots",
])

export type Collection = z.infer<typeof collectionSchema>

const { kebab, item } = idPatterns
const itemCollections = collectionSchema.exclude(["slots"]).options.join("|")
const segment = `/(?:(?:${itemCollections})/${item}|slots/${kebab})`

export const nodeIdSchema = z
  .string()
  .max(64)
  .regex(
    new RegExp(`^${kebab}(?:\\[\\])?$`),
    "Must be kebab-case, start with a letter, and may end in [] for templates"
  )

export const slotIdSchema = z
  .string()
  .max(64)
  .regex(new RegExp(`^${kebab}$`), "Must be kebab-case and start with a letter")

export const addressSchema = z
  .string()
  .max(256)
  .regex(
    new RegExp(`^${kebab}(?:\\[\\])?(?:${segment})*$`),
    "Must be node-id followed by /collection/item-id segments"
  )

export type Address = z.infer<typeof addressSchema>
