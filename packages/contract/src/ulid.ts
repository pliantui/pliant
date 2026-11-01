import * as z from "zod"

export const ulidSchema = z
  .string()
  .regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/, "Must be a ULID")
