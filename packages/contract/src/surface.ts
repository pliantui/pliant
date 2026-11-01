import * as z from "zod"

import { idPatterns } from "./identifier"

const param = "[A-Za-z_][A-Za-z0-9_-]*"
const char = "(?:[A-Za-z0-9_~-]|%[89A-F][0-9A-F])"
const segment = `(?:\\.*${char}[.]*(?:${char}[.]*)*|\\[${param}\\]|\\[\\.\\.\\.${param}\\]|\\[\\[\\.\\.\\.${param}\\]\\])`

export const surfaceSchema = z
  .string()
  .max(256)
  .regex(
    new RegExp(
      `^(?:@app|/(?:${segment}(?:/${segment})*)?|${idPatterns.kebab})$`
    ),
    "Must be a route pattern, a kebab-case surface id, or @app"
  )

export type Surface = z.infer<typeof surfaceSchema>
