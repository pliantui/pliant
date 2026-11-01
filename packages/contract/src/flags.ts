import * as z from "zod"

export const flagsSchema = z.object({
  critical: z.boolean().optional(),
  required: z.boolean().optional(),
  destructive: z.boolean().optional(),
  locked: z.boolean().optional(),
  defaultable: z.boolean().optional(),
  pinned: z.boolean().optional(),
})

export type Flags = z.infer<typeof flagsSchema>
