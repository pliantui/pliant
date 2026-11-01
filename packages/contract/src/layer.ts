import * as z from "zod"

export const layerSchema = z.enum(["org", "team", "personal", "session"])

export type Layer = z.infer<typeof layerSchema>
