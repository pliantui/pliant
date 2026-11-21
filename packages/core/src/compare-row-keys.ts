import { compareCodePoints } from "./compare-code-points"

const isNumberKey = (key: unknown): key is number =>
  typeof key === "number" && !Number.isNaN(key)

/**
 * Compares two row keys for display order. Number keys come first, in
 * numeric order, so `2` comes before `10`. Every other key follows, by code
 * point of its text, so `"10"` comes before `"2"`. TanStack Table's
 * `getRowId` gives text, so its keys compare by code point.
 */
export function compareRowKeys(a: unknown, b: unknown): number {
  const aIsNumber = isNumberKey(a)
  const bIsNumber = isNumberKey(b)
  if (aIsNumber && bIsNumber) return a - b
  if (aIsNumber) return -1
  if (bIsNumber) return 1
  return compareCodePoints(String(a), String(b))
}
