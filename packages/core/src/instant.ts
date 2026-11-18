export interface Instant {
  readonly seconds: number
  readonly fraction: string
}

const isoPattern = /^(.{19})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/

/**
 * Reads an ISO 8601 date-time with an offset as whole seconds since the epoch
 * plus its fractional digits, so instants compare exactly at any precision.
 */
export function parseInstant(value: string): Instant | undefined {
  const match = isoPattern.exec(value)
  const [, base, fraction = "", offset] = match ?? []
  if (base === undefined || offset === undefined) {
    return undefined
  }
  const millis = Date.parse(`${base}${offset}`)
  return Number.isNaN(millis)
    ? undefined
    : { seconds: millis / 1000, fraction: fraction.replace(/0+$/, "") }
}

// An instant that can't be read sorts first, which keeps the order total.
export function compareInstants(
  a: Instant | undefined,
  b: Instant | undefined
): number {
  if (!a || !b) {
    return (a ? 1 : 0) - (b ? 1 : 0)
  }
  if (a.seconds !== b.seconds) {
    return a.seconds - b.seconds
  }
  return a.fraction < b.fraction ? -1 : a.fraction > b.fraction ? 1 : 0
}
