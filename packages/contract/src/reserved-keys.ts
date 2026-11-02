import * as z from "zod"

const reservedKeys = new Set(["__proto__", "constructor", "prototype"])

function reservedKeyPath(value: unknown): PropertyKey[] | undefined {
  const seen = new WeakSet<object>()
  const pending: [unknown, PropertyKey[]][] = [[value, []]]
  for (let next = pending.pop(); next; next = pending.pop()) {
    const [current, path] = next
    if (typeof current !== "object" || current === null || seen.has(current)) {
      continue
    }
    seen.add(current)
    for (const [key, child] of Object.entries(current)) {
      const childPath = [...path, Array.isArray(current) ? Number(key) : key]
      if (!Array.isArray(current) && reservedKeys.has(key)) {
        return childPath
      }
      pending.push([child, childPath])
    }
  }
  return undefined
}

// Older Zod versions turn an own __proto__ key in a loose object into the
// parsed object's prototype, so reserved keys are rejected before Zod parses.
export function withoutReservedKeys<T extends z.ZodType>(
  schema: T
): z.ZodPipe<z.core.$ZodTransform, T> {
  return z.preprocess((value, ctx) => {
    const path = reservedKeyPath(value)
    if (path) {
      ctx.addIssue({
        code: "custom",
        path,
        message: `Must not have a ${String(path.at(-1))} key`,
        input: value,
      })
      return z.NEVER
    }
    return value
  }, schema)
}
