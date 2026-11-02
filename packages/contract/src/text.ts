import * as z from "zod"

// Zod before 4.5 counts UTF-16 units; contract 1 counts code points, as JSON
// Schema's maxLength does. Use `.max` once the minimum Zod version is 4.5.
function isWithinCodePoints(value: string, max: number) {
  if (value.length <= max) {
    return true
  }
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

export function textSchema(max: number, { min = 0 }: { min?: number } = {}) {
  const schema = min > 0 ? z.string().min(min) : z.string()
  return schema
    .superRefine((value, ctx) => {
      if (!isWithinCodePoints(value, max)) {
        ctx.addIssue({
          code: "too_big",
          origin: "string",
          maximum: max,
          inclusive: true,
          input: value,
        })
      }
    })
    .meta({ maxLength: max })
}
