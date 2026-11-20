export const orderStatuses = ["paid", "pending", "overdue", "refunded"] as const

export const orderRegions = ["North", "South", "East", "West"] as const

export type OrderStatus = (typeof orderStatuses)[number]

type OrderRegion = (typeof orderRegions)[number]

export interface Order {
  id: string
  customer: string
  region: OrderRegion
  status: OrderStatus
  value: number
  createdAt: string
  notes: string
}

const customers = [
  "Aarav Textiles",
  "Bharat Foods",
  "Chandra Electronics",
  "Deccan Traders",
  "Eastern Spices",
  "Ganga Pharma",
  "Himalaya Crafts",
  "Indus Logistics",
  "Jaipur Gems",
  "Kaveri Agro",
  "Lotus Stationers",
  "Malabar Coffee",
  "Narmada Steel",
  "Orchid Apparel",
  "Punjab Dairy",
  "Rajdhani Motors",
]

const notes = [
  "",
  "",
  "",
  "Deliver before month end",
  "Requested GST invoice",
  "Bulk discount applied",
  "Customer asked for a callback",
  "Partial shipment agreed",
  "Repeat order",
  "Awaiting purchase order",
]

const orderCount = 200
const firstOrderDate = Date.UTC(2026, 0, 1)
const dayInMs = 24 * 60 * 60 * 1000

function mulberry32(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function generateOrders(seed: number): Order[] {
  const random = mulberry32(seed)
  const pick = <T>(items: readonly T[]): T => {
    const item = items[Math.floor(random() * items.length)]
    if (item === undefined) throw new Error("Cannot pick from an empty list")
    return item
  }

  return Array.from({ length: orderCount }, (_, index) => {
    const createdAt = new Date(
      firstOrderDate + Math.floor(random() * 300) * dayInMs
    ).toISOString()
    return {
      id: `ORD-${String(1001 + index)}`,
      customer: pick(customers),
      region: pick(orderRegions),
      status: pick(orderStatuses),
      value: Math.round((1500 + random() ** 2 * 248500) / 50) * 50,
      createdAt,
      notes: pick(notes),
    }
  })
}

export const orders = generateOrders(2026)
