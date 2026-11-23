"use client"

import { cn } from "cn"

import { ScriptedFrame } from "@/components/demo/scripted-frame"
import { useScriptedAsks } from "@/components/demo/use-scripted-asks"
import { mockupAsks } from "@/lib/components/mockup-asks"
import { formatCurrency } from "@/lib/demo/format"
import type { Order } from "@/lib/demo/schema"

const asks = mockupAsks.list

// A few of the company's orders, from the shared demo data.
export function ListMockup({ orders }: { orders: Order[] }) {
  const scripted = useScriptedAsks()
  let rows = orders
  if (scripted.has(asks.overdueSouth)) {
    rows = rows.filter(
      (row) => row.status === "overdue" && row.region === "South"
    )
  }
  const grouped = scripted.has(asks.group)
  const compact = scripted.has(asks.compact)
  const groups = grouped
    ? [...new Set(rows.map((row) => row.customer))].map((customer) => ({
        customer,
        rows: rows.filter((row) => row.customer === customer),
      }))
    : [{ customer: null, rows }]

  return (
    <ScriptedFrame
      label="orders list"
      asks={Object.values(asks)}
      scripted={scripted}
    >
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
                    {row.customer} · {row.region} ·{" "}
                    <span className="capitalize">{row.status}</span>
                  </span>
                  <span className="tabular-nums">
                    {formatCurrency(row.value)}
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
