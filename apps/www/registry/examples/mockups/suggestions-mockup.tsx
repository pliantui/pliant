"use client"

import {
  ScriptedFrame,
  useScriptedAsks,
} from "@/components/demo/scripted-frame"
import { mockupAsks } from "@/lib/components/mockup-asks"
import { formatCurrency } from "@/lib/demo/format"
import type { Order } from "@/lib/demo/schema"

const asks = mockupAsks.suggestions

// A few of the company's orders, from the shared demo data.
export function SuggestionsMockup({ orders }: { orders: Order[] }) {
  const scripted = useScriptedAsks()
  let rows = orders
  if (scripted.has(asks.overdue))
    rows = rows.filter((row) => row.status === "overdue")
  if (scripted.has(asks.largest))
    rows = rows.toSorted((a, b) => b.value - a.value)

  return (
    <ScriptedFrame
      label="orders"
      asks={Object.values(asks)}
      scripted={scripted}
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Suggested asks for this table. Picking one previews the change.
        </p>
        <table className="w-full text-sm">
          <caption className="sr-only">Orders</caption>
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 font-medium">Order</th>
              <th className="py-2 font-medium">Customer</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="py-2 font-medium">{row.id}</td>
                <td className="py-2">{row.customer}</td>
                <td className="py-2 capitalize">{row.status}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatCurrency(row.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ScriptedFrame>
  )
}
