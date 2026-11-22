// #region schema
import * as z from "zod"

export const ticketSchema = z.object({
  // Required, so users can't hide or fold it away.
  subject: z.string().min(5),
  // Optional, so users can hide it or move it into More fields.
  cc: z.email().optional(),
  // Has a default, so users can hide it too.
  priority: z.enum(["low", "normal", "high"]).default("normal"),
})
// #endregion schema
