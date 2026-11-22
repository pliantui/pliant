"use client"

import {
  ScriptedFrame,
  useScriptedAsks,
} from "@/components/demo/scripted-frame"

const asks = ["only overdue orders", "largest orders first"]

const orders = [
  { id: "ORD-1042", customer: "Kaveri Agro", status: "Overdue", value: 96550 },
  {
    id: "ORD-1043",
    customer: "Lotus Stationers",
    status: "Paid",
    value: 22900,
  },
  {
    id: "ORD-1045",
    customer: "Deccan Traders",
    status: "Overdue",
    value: 41200,
  },
  { id: "ORD-1046", customer: "Himalaya Crafts", status: "Paid", value: 80850 },
]

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

export function SuggestionsMockup() {
  const scripted = useScriptedAsks()
  let rows = orders
  if (scripted.has(asks[0] ?? ""))
    rows = rows.filter((row) => row.status === "Overdue")
  if (scripted.has(asks[1] ?? ""))
    rows = rows.toSorted((a, b) => b.value - a.value)

  return (
    <ScriptedFrame label="orders" asks={asks} scripted={scripted}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Suggested for you, from what your team changes most on this table.
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
                <td className="py-2">{row.status}</td>
                <td className="py-2 text-right tabular-nums">
                  {rupees.format(row.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ScriptedFrame>
  )
}
