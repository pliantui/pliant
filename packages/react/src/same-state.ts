function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * Whether two pieces of table state are equal as data: arrays by their
 * items, plain objects by their keys and values, `Date`s by their time
 * (filter values often hold dates rebuilt on every render), and anything
 * else only to itself.
 */
export function isSameState(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true
  }
  if (a instanceof Date && b instanceof Date) {
    return Object.is(a.getTime(), b.getTime())
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => isSameState(item, b[index]))
    )
  }
  if (!isPlainObject(a) || !isPlainObject(b)) {
    return false
  }
  const keys = Object.keys(a)
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && isSameState(a[key], b[key]))
  )
}
