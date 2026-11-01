import * as z from "zod"

export const capabilitySchema = z.enum([
  "props",
  "label",
  "hideable",
  "slots",
  "layout",
  "insertable",
  "form",
  "presentation",
  "nav",
  "actions",
  "data",
])

export type Capability = z.infer<typeof capabilitySchema>
