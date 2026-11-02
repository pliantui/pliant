import * as z from "zod"

const reservedKeys = new Set(["__proto__", "constructor", "prototype"])

interface Node {
  value: unknown
  key?: PropertyKey
  parent?: Node
}

function pathOf(node: Node): PropertyKey[] {
  const path: PropertyKey[] = []
  for (let current = node; current.parent; current = current.parent) {
    if (current.key !== undefined) {
      path.push(current.key)
    }
  }
  return path.reverse()
}

function reservedKeyPath(value: unknown): PropertyKey[] | undefined {
  const seen = new WeakSet<object>()
  const pending: Node[] = [{ value }]
  for (let node = pending.pop(); node; node = pending.pop()) {
    if (typeof node.key === "string" && reservedKeys.has(node.key)) {
      return pathOf(node)
    }
    const current = node.value
    if (typeof current !== "object" || current === null || seen.has(current)) {
      continue
    }
    seen.add(current)
    const entries: [string, unknown][] = Object.entries(current)
    const isArray = Array.isArray(current)
    for (let index = entries.length - 1; index >= 0; index--) {
      const entry = entries[index]
      if (entry) {
        const [key, child] = entry
        pending.push({
          value: child,
          key: isArray ? Number(key) : key,
          parent: node,
        })
      }
    }
  }
  return undefined
}

// Older Zod versions turn an own __proto__ key in a loose object into the
// parsed object's prototype, so reserved keys are rejected before Zod parses.
export function withoutReservedKeys<T extends z.ZodType>(
  schema: T
): z.ZodPipe<z.core.$ZodTransform<unknown, z.input<T>>, T> {
  return z.preprocess((value: z.input<T>, ctx) => {
    const path = reservedKeyPath(value)
    if (path) {
      ctx.addIssue({
        code: "custom",
        path,
        message: `Must not have a ${String(path.at(-1))} key`,
        params: { reservedKey: true },
        input: value,
      })
      return z.NEVER
    }
    return value
  }, schema)
}
