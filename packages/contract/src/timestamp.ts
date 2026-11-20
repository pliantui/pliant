import * as z from "zod"

// RFC 3339 requires seconds. Older Zod 4 releases accept a time without them,
// such as 2026-11-19T10:15Z, so the refinement rejects that on every version.
export const timestampSchema = z.iso
  .datetime({ offset: true, abort: true })
  .refine((value) => !/T\d\d:\d\d(?!:)/.test(value), "Must include seconds")
