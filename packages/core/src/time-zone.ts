export const dayMs = 86_400_000

/**
 * Reads instants in one IANA time zone. Days are counted from 1970-01-01,
 * and a wall-clock time is the milliseconds from that epoch as if the zone
 * were UTC.
 */
export interface TimeZone {
  /** The wall-clock time of an instant. */
  readonly wallClock: (instant: number) => number
  /** The instant of a wall-clock time. */
  readonly instant: (wallClock: number) => number
}

/** The UTC date of a day: its year, month (1 to 12), day and weekday (0 for Sunday). */
export function civil(day: number) {
  const date = new Date(day * dayMs)
  return [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCDay(),
  ] as const
}

/** The day of a calendar date, which may overflow its month or year. */
export function dayOf(year: number, month: number, day: number) {
  return new Date(0).setUTCFullYear(year, month - 1, day) / dayMs
}

/**
 * Throws a `RangeError` for a time zone the runtime doesn't know, as
 * `Intl.DateTimeFormat` does.
 */
export function createTimeZone(timeZone: string): TimeZone {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    era: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  })
  const wallClock = (instant: number) => {
    const part: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {}
    let bc = false
    for (const { type, value } of format.formatToParts(instant)) {
      part[type] = Number(value)
      bc ||= value === "BC"
    }
    const year = part.year ?? 0
    const time =
      ((part.hour ?? 0) * 60 + (part.minute ?? 0)) * 60_000 +
      (part.second ?? 0) * 1000
    return (
      dayOf(bc ? 1 - year : year, part.month ?? 1, part.day ?? 1) * dayMs +
      time +
      (((instant % 1000) + 1000) % 1000)
    )
  }
  const offset = (instant: number) => wallClock(instant) - instant
  // A wall-clock time that a transition skips is moved forward by the length
  // of the gap, and one that a transition repeats is the earlier instant, as
  // in Temporal's "compatible" disambiguation.
  const instant = (local: number) => {
    const before = local - offset(local - dayMs)
    if (wallClock(before) === local) {
      return before
    }
    const after = local - offset(local + dayMs)
    return wallClock(after) === local ? after : before
  }
  return { wallClock, instant }
}
