import * as z from "zod"

export const propValueSchema = z.string().min(1).max(64)

export const scalarSchema = z.union([
  z.string().max(200),
  z.number(),
  z.boolean(),
])

export const valueSchema = z.union([
  scalarSchema,
  z.null(),
  z.array(scalarSchema).max(100),
])
