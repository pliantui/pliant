import { mulberry32 } from "./random"
import { orderRegions } from "./schema"

// Saffron Supply Co.'s full order history: too many rows to send to a
// browser, so the server sums them and sends only the totals, as a database
// query would. The rows are generated as they're summed, never stored. Use
// it only from server components.

export const orderHistoryRows = 250_000

const firstDay = Date.UTC(2026, 0, 1)
const days = 300
const dayInMs = 24 * 60 * 60 * 1000

interface OrderHistoryPoint {
  // The first day of the period, as `YYYY-MM-DD`.
  start: string
  total: number
  byRegion: Record<string, number>
}

export interface OrderHistoryTotals {
  monthly: OrderHistoryPoint[]
  weekly: OrderHistoryPoint[]
}

function add(
  points: Map<string, Record<string, number>>,
  start: string,
  region: string,
  value: number
) {
  const regions = points.get(start) ?? {}
  regions[region] = (regions[region] ?? 0) + value
  points.set(start, regions)
}

function toPoints(points: Map<string, Record<string, number>>) {
  return [...points.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([start, byRegion]) => ({
      start,
      total: Object.values(byRegion).reduce((sum, value) => sum + value, 0),
      byRegion,
    }))
}

export function sumOrderHistory(): OrderHistoryTotals {
  const random = mulberry32(2028)
  const monthly = new Map<string, Record<string, number>>()
  const weekly = new Map<string, Record<string, number>>()

  for (let index = 0; index < orderHistoryRows; index++) {
    const day = Math.floor(random() * days)
    const region = orderRegions[Math.floor(random() * orderRegions.length)]
    const value = Math.round((500 + random() ** 2 * 60000) / 50) * 50
    if (region === undefined) continue
    const date = new Date(firstDay + day * dayInMs).toISOString()
    const week = new Date(firstDay + Math.floor(day / 7) * 7 * dayInMs)
    add(monthly, `${date.slice(0, 7)}-01`, region, value)
    add(weekly, week.toISOString().slice(0, 10), region, value)
  }

  return { monthly: toPoints(monthly), weekly: toPoints(weekly) }
}
