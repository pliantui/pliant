import * as z from "zod"

import { idPatterns } from "./identifier"

const param = "[A-Za-z_][A-Za-z0-9_-]*"
const tail = "%[89AB][0-9A-F]"
const utf8 = [
  `%(?:C[2-9A-F]|D[0-9A-F])${tail}`,
  `%E0%[AB][0-9A-F]${tail}`,
  `%E[1-9A-CEF]${tail}${tail}`,
  `%ED%[89][0-9A-F]${tail}`,
  `%F0%[9AB][0-9A-F]${tail}${tail}`,
  `%F[1-3]${tail}${tail}${tail}`,
  `%F4%8[0-9A-F]${tail}${tail}`,
].join("|")
const char = `(?:[A-Za-z0-9_~-]|${utf8})`
const segment = `(?:\\.*${char}[.]*(?:${char}[.]*)*|\\[${param}\\]|\\[\\.\\.\\.${param}\\]|\\[\\[\\.\\.\\.${param}\\]\\])`

export const surfaceSchema = z
  .string()
  .max(256)
  .regex(
    new RegExp(
      `^(?:@app|/(?:${segment}(?:/${segment})*)?|${idPatterns.kebab})$`
    ),
    "Must be a route pattern (ASCII or uppercase UTF-8 percent-encoding), a kebab-case surface id, or @app"
  )

export type Surface = z.infer<typeof surfaceSchema>
