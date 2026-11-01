import * as z from "zod"

import { itemIdSchema } from "./identifier"

export const sortSchema = z
  .array(
    z.strictObject({
      field: itemIdSchema,
      dir: z.enum(["asc", "desc"]),
    })
  )
  .max(8)
  .refine(
    (sort) => new Set(sort.map(({ field }) => field)).size === sort.length,
    "Must sort by each field at most once"
  )

export type Sort = z.infer<typeof sortSchema>
