import * as z from "zod"

export const breakpointSchema = z.enum(["base", "sm", "md", "lg", "xl", "2xl"])

export const layoutModeSchema = z.enum(["stack", "row", "grid"])

export const layoutColumnsSchema = z.int().min(1).max(4)

export const layoutAlignSchema = z.enum(["start", "center", "end", "between"])
