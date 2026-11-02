import * as z from "zod"

function isWithinCodePoints(value: string, max: number) {
  let count = 0
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        index++
      }
    }
    if (++count > max) {
      return false
    }
  }
  return true
}

export function textSchema(max: number) {
  return z
    .string()
    .refine(
      (value) => isWithinCodePoints(value, max),
      `Too big: expected string to have <=${String(max)} characters`
    )
    .meta({ maxLength: max })
}
