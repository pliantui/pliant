import { compareCodePoints } from "./compare-code-points"

const isNumber = (key: unknown): key is number =>
  typeof key === "number" && !Number.isNaN(key)

/**
 * Compares two row keys for display order: numerically when both are
 * numbers, otherwise by code point as text, with a number before text.
 * TanStack Table's `getRowId` gives text, so its keys compare by code point.
 */
export function compareRowKeys(a: unknown, b: unknown): number {
  if (isNumber(a) && isNumber(b)) {
    return a - b
  }
  return (
    Number(isNumber(b)) - Number(isNumber(a)) ||
    compareCodePoints(String(a), String(b))
  )
}
