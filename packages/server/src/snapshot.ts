/**
 * Copies a value's own enumerable string-keyed properties, and those of the
 * objects and arrays in it down to `depth` levels, reading each property
 * once. Arrays are copied up to their first `maxItems` items, so a huge
 * array isn't copied before it is rejected. Checking and keeping the copy means a getter can't return one value
 * when checked and another when kept, and an inherited property is never
 * read. Functions, and anything below `depth`, are kept as they are.
 */
export function snapshot(
  value: unknown,
  depth: number,
  maxItems: number
): unknown {
  if (depth === 0 || typeof value !== "object" || value === null) {
    return value
  }
  if (Array.isArray(value)) {
    const items: readonly unknown[] = value
    return Array.from(
      { length: Math.min(items.length, maxItems) },
      (_, index) => snapshot(items[index], depth - 1, maxItems)
    )
  }
  return Object.fromEntries(
    Object.keys(value).map((key) => [
      key,
      snapshot(Reflect.get(value, key), depth - 1, maxItems),
    ])
  )
}

/** Whether a value is an object that isn't an array or a function. */
export function isRecord(
  value: unknown
): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
