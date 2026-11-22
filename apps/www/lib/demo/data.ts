import {
  orderStatuses,
  type Customer,
  type MonthlyRevenue,
  type Order,
  type TeamMember,
} from "./schema"

// The rows of the demo data, generated from a fixed seed so every build and
// every recording sees the same company. Import it from server components
// and pass the rows down, so the generator stays out of the client bundle.

export const team: TeamMember[] = [
  {
    name: "Meera Iyer",
    email: "meera@saffronsupply.example",
    role: "Head of sales",
    team: "Sales",
  },
  {
    name: "Arjun Mehta",
    email: "arjun@saffronsupply.example",
    role: "Account manager",
    team: "Sales North",
  },
  {
    name: "Kavya Reddy",
    email: "kavya@saffronsupply.example",
    role: "Account manager",
    team: "Sales South",
  },
  {
    name: "Rohan Das",
    email: "rohan@saffronsupply.example",
    role: "Account manager",
    team: "Sales East",
  },
  {
    name: "Sana Sheikh",
    email: "sana@saffronsupply.example",
    role: "Account manager",
    team: "Sales West",
  },
  {
    name: "Vikram Nair",
    email: "vikram@saffronsupply.example",
    role: "Finance lead",
    team: "Finance",
  },
  {
    name: "Priya Kapoor",
    email: "priya@saffronsupply.example",
    role: "Support lead",
    team: "Support",
  },
  {
    name: "Imran Qureshi",
    email: "imran@saffronsupply.example",
    role: "Support agent",
    team: "Support",
  },
]

const customers: Customer[] = (
  [
    ["Aarav Textiles", "West"],
    ["Bharat Foods", "North"],
    ["Chandra Electronics", "East"],
    ["Deccan Traders", "South"],
    ["Eastern Spices", "East"],
    ["Ganga Pharma", "North"],
    ["Himalaya Crafts", "North"],
    ["Indus Logistics", "West"],
    ["Jaipur Gems", "North"],
    ["Kaveri Agro", "South"],
    ["Lotus Stationers", "West"],
    ["Malabar Coffee", "South"],
    ["Narmada Steel", "West"],
    ["Orchid Apparel", "East"],
    ["Punjab Dairy", "North"],
    ["Rajdhani Motors", "North"],
  ] as const
).map(([name, region]) => ({ name, region }))

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
    const customer = pick(customers)
    return {
      id: `ORD-${String(1001 + index)}`,
      customer: customer.name,
      region: customer.region,
      status: pick(orderStatuses),
      value: Math.round((1500 + random() ** 2 * 248500) / 50) * 50,
      createdAt,
      notes: pick(notes),
    }
  })
}

export const orders = generateOrders(2026)

// Order value by month and status, for charts and stat cards.
export const monthlyRevenue: MonthlyRevenue[] = Array.from(
  { length: 10 },
  (_, month) => {
    const key = `2026-${String(month + 1).padStart(2, "0")}`
    const inMonth = orders.filter((order) => order.createdAt.startsWith(key))
    const total = (status: Order["status"]) =>
      inMonth
        .filter((order) => order.status === status)
        .reduce((sum, order) => sum + order.value, 0)
    return {
      month: `${key}-01`,
      paid: total("paid"),
      pending: total("pending"),
      overdue: total("overdue"),
    }
  }
)
