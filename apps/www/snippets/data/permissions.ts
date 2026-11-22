import { allRows, defineDataset } from "@pliantui/server/data"

interface User {
  id: string
  orgId: string
  region: "North" | "South" | "East" | "West"
  role: "admin" | "sales" | "finance" | "support"
}

// #region permissions
export const ordersDataset = defineDataset({
  id: "orders",
  timeZone: "Asia/Kolkata",
  fields: {
    id: { type: "id" },
    customer: { type: "string" },
    region: { type: "enum", values: ["North", "South", "East", "West"] },
    value: { type: "currency", currency: "INR" },
    notes: {
      type: "text",
      access: (user: User) => user.role !== "sales",
    },
  },
  access: (user: User) => user.role !== "support",
  scope: (user: User) =>
    user.role === "admin"
      ? allRows
      : { orgId: user.orgId, region: user.region },
  privacy: { minGroupSize: 5 },
})
// #endregion permissions
