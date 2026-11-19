import * as z from "zod"

export const flagsSchema = z
  .strictObject({
    critical: z.boolean().optional(),
    required: z.boolean().optional(),
    destructive: z.boolean().optional(),
    locked: z.boolean().optional(),
    defaultable: z.boolean().optional(),
    pinned: z.boolean().optional(),
    primary: z.boolean().optional(),
  })
  .superRefine((flags, ctx) => {
    // A destructive action can never sit next to or above the primary one, so
    // one address can't be both.
    if (flags.primary === true && flags.destructive === true) {
      ctx.addIssue({
        code: "custom",
        path: ["primary"],
        message: "An action can't be both primary and destructive",
      })
    }
  })

export type Flags = z.infer<typeof flagsSchema>
