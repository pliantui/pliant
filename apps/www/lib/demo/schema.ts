// The shape of the data of Saffron Supply Co., a wholesale supplier of
// packaging, stationery and pantry goods across India, which every example,
// block, chart and docs preview shares. This file is safe to import from
// client components; the generated rows live in `data.ts`.

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

export interface Customer {
  name: string
  region: OrderRegion
}

export interface TeamMember {
  name: string
  email: string
  role: string
  team: string
}

export const dealStages = ["lead", "qualified", "proposal", "won"] as const

export type DealStage = (typeof dealStages)[number]

export interface Deal {
  id: string
  customer: string
  stage: DealStage
  value: number
  owner: string
  // The day of the deal's latest call, email or meeting, as YYYY-MM-DD.
  lastActivityAt: string
}

export interface MonthlyRevenue {
  // The first day of the month, as `YYYY-MM-01`.
  month: string
  paid: number
  pending: number
  overdue: number
}

export const ordersDataset = {
  fields: {
    id: { type: "id" },
    customer: { type: "string" },
    region: { type: "enum", values: orderRegions },
    status: { type: "enum", values: orderStatuses },
    value: { type: "currency", currency: "INR" },
    createdAt: { type: "datetime" },
    notes: { type: "text" },
  },
  timeZone: "UTC",
} as const
