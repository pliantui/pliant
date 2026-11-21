import { compareCodePoints } from "./compare-code-points"

/**
 * Compares two row keys for display order: numerically when both are
 * numbers, otherwise by code point of their text, so `2` comes before `10`
 * but `"10"` before `"2"`. TanStack Table's `getRowId` gives text, so its
 * keys compare by code point. Keys that mix numbers and text don't always
 * have a consistent order: `2` is before `10`, `10` before `"15"` and
 * `"15"` before `2`.
 */
export function compareRowKeys(a: unknown, b: unknown): number {
  // NaN compares as text, so the comparison stays consistent.
  const difference =
    typeof a === "number" && typeof b === "number" ? a - b : Number.NaN
  return Number.isNaN(difference)
    ? compareCodePoints(String(a), String(b))
    : difference
}
