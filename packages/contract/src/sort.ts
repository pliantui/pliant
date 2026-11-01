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

export type Sort = z.infer<typeof sortSchema>
