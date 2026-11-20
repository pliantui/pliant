const percent = "percent"

/**
 * The unit of `a × b` by the function catalog's product rule, or `null` when
 * the units can't be multiplied.
 */
export function productUnit(
  a: string | undefined,
  b: string | undefined
): string | undefined | null {
  if (a === undefined || a === percent) {
    return b ?? a
  }
  if (b === undefined || b === percent) {
    return a
  }
  return null
}

/**
 * The unit of `a ÷ b` by the function catalog's quotient rule, or `null` when
 * the units can't be divided.
 */
export function quotientUnit(
  a: string | undefined,
  b: string | undefined
): string | undefined | null {
  if (b === undefined || (b === percent && a !== percent)) {
    return a
  }
  return a === b ? undefined : null
}
