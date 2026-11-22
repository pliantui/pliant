// #region dataset
import { defineDataset } from "@pliantui/server/data"

interface User {
  id: string
  orgId: string
  role: "admin" | "sales" | "finance"
}

export const ordersDataset = defineDataset({
  id: "orders",
  describe: "Orders placed by our customers, one row per order.",
  timeZone: "Asia/Kolkata",
  fields: {
    id: { type: "id", label: "Order" },
    customer: { type: "string", label: "Customer" },
    region: {
      type: "enum",
      label: "Region",
      values: ["North", "South", "East", "West"],
    },
    status: {
      type: "enum",
      label: "Status",
      values: ["paid", "pending", "overdue", "refunded"],
    },
    value: { type: "currency", currency: "INR", label: "Value" },
    createdAt: { type: "datetime", label: "Created" },
    notes: { type: "text", label: "Notes", exposeToAI: false },
  },
  scope: (user: User) => ({ orgId: user.orgId }),
})
// #endregion dataset
