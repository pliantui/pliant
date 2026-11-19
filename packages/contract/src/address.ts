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
const node = `${kebab}(?:\\[\\])?`
const addressMessage =
  "Must be node-id followed by /collection/item-id segments"
const perRow = new RegExp(`^${kebab}\\[[^\\]]+\\](?:/|$)`)

// Checked first and aborting, so a reserved per-row address gets only this
// issue and can be told apart from a malformed one.
function addressString(max: number) {
  return z
    .string()
    .max(max)
    .refine((value) => !perRow.test(value), {
      abort: true,
      message:
        "Per-row addresses such as order-card[42] are reserved; use order-card[] for every row",
      params: { code: "per-row-address-reserved" },
    })
}

export const nodeIdSchema = addressString(64).regex(
  new RegExp(`^${node}$`),
  "Must be kebab-case, start with a letter, and may end in [] for templates"
)

export const slotIdSchema = z
  .string()
  .max(64)
  .regex(new RegExp(`^${kebab}$`), "Must be kebab-case and start with a letter")

export const addressSchema = addressString(256).regex(
  new RegExp(`^${node}(?:${segment})*$`),
  addressMessage
)

export type Address = z.infer<typeof addressSchema>

export function itemAddressSchema(
  collection?: Collection,
  { template = true }: { template?: boolean } = {}
) {
  const root = template ? node : kebab
  const last =
    collection === undefined
      ? segment
      : `/${collection}/${collection === "slots" ? kebab : item}`
  return addressString(256).regex(
    new RegExp(`^${root}(?:${segment})*${last}$`),
    collection === undefined
      ? "Must address an item, for example orders-table/columns/value"
      : `Must address an item in ${collection}`
  )
}

export function nodeAddressSchema({
  template = true,
}: { template?: boolean } = {}) {
  return addressString(256).regex(
    new RegExp(`^${template ? node : kebab}(?:/slots/${kebab})*$`),
    template
      ? "Must address a node, for example orders-table or dashboard/slots/revenue"
      : "Must address a node that isn't a template"
  )
}
