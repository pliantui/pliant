import { orderRegions, orderStatuses } from "./data"

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
