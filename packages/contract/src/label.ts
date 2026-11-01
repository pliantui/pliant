import * as z from "zod"

export const labelSchema = z.string().min(1).max(80)
