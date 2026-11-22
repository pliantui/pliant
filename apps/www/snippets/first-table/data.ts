// #region data
export type OrderStatus = "paid" | "pending" | "overdue" | "refunded"

export interface Order {
  id: string
  customer: string
  region: "North" | "South" | "East" | "West"
  status: OrderStatus
  value: number
  createdAt: string
  notes: string
}

export const orders: Order[] = [
  {
    id: "ORD-1001",
    customer: "Malabar Coffee",
    region: "South",
    status: "paid",
    value: 48200,
    createdAt: "2026-03-02",
    notes: "Repeat order",
  },
  {
    id: "ORD-1002",
    customer: "Narmada Steel",
    region: "West",
    status: "overdue",
    value: 186500,
    createdAt: "2026-03-04",
    notes: "Awaiting purchase order",
  },
  {
    id: "ORD-1003",
    customer: "Ganga Pharma",
    region: "North",
    status: "pending",
    value: 23750,
    createdAt: "2026-03-05",
    notes: "",
  },
  {
    id: "ORD-1004",
    customer: "Eastern Spices",
    region: "East",
    status: "paid",
    value: 9800,
    createdAt: "2026-03-09",
    notes: "Requested GST invoice",
  },
  {
    id: "ORD-1005",
    customer: "Jaipur Gems",
    region: "North",
    status: "refunded",
    value: 61300,
    createdAt: "2026-03-11",
    notes: "Customer asked for a callback",
  },
  {
    id: "ORD-1006",
    customer: "Kaveri Agro",
    region: "South",
    status: "paid",
    value: 132400,
    createdAt: "2026-03-14",
    notes: "Bulk discount applied",
  },
]
// #endregion data
