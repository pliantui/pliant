"use client"

import { cn } from "cn"

import {
  ScriptedFrame,
  useScriptedAsks,
} from "@/components/demo/scripted-frame"

const asks = [
  "largest orders first",
  "only overdue orders in the south",
  "group by customer",
  "make the list compact",
]

const orders = [
  {
    id: "ORD-1042",
    customer: "Kaveri Agro",
    region: "South",
    status: "Overdue",
    value: 96550,
  },
  {
    id: "ORD-1043",
    customer: "Lotus Stationers",
    region: "West",
    status: "Paid",
    value: 22900,
  },
  {
    id: "ORD-1044",
    customer: "Kaveri Agro",
    region: "South",
    status: "Pending",
    value: 4750,
  },
  {
    id: "ORD-1045",
    customer: "Deccan Traders",
    region: "South",
    status: "Overdue",
    value: 41200,
  },
  {
    id: "ORD-1046",
    customer: "Himalaya Crafts",
    region: "North",
    status: "Paid",
    value: 80850,
  },
]

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

export function ListMockup() {
  const scripted = useScriptedAsks()
  let rows = orders
  if (scripted.has(asks[1] ?? "")) {
    rows = rows.filter(
      (row) => row.status === "Overdue" && row.region === "South"
    )
  }
  if (scripted.has(asks[0] ?? "")) {
    rows = rows.toSorted((a, b) => b.value - a.value)
  }
  const grouped = scripted.has(asks[2] ?? "")
  const compact = scripted.has(asks[3] ?? "")
  const groups = grouped
    ? [...new Set(rows.map((row) => row.customer))].map((customer) => ({
        customer,
        rows: rows.filter((row) => row.customer === customer),
      }))
    : [{ customer: null, rows }]

  return (
    <ScriptedFrame label="orders list" asks={asks} scripted={scripted}>
      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <div key={group.customer ?? "all"}>
            {group.customer && (
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {group.customer} · {group.rows.length}
              </p>
            )}
            <ul
              aria-label={
                group.customer
                  ? `${group.customer}, ${String(group.rows.length)} orders`
                  : "Orders"
              }
              className="divide-y rounded-xl border"
            >
              {group.rows.map((row) => (
                <li
                  key={row.id}
                  className={cn(
                    "flex items-center justify-between gap-3 px-3 text-sm",
                    compact ? "py-1.5" : "py-3"
                  )}
                >
                  <span className="font-medium">{row.id}</span>
                  <span className="flex-1 truncate text-muted-foreground">
                    {row.customer} · {row.region} · {row.status}
                  </span>
                  <span className="tabular-nums">
                    {rupees.format(row.value)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </ScriptedFrame>
  )
}
