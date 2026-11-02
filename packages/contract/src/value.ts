import * as z from "zod"

import { textSchema } from "./text"

export const propValueSchema = textSchema(64).min(1)

export const scalarSchema = z.union([textSchema(200), z.number(), z.boolean()])

export const valueSchema = z.union([
  scalarSchema,
  z.null(),
  z.array(scalarSchema).max(100),
])
