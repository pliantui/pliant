"use client"

import { ScriptedFrame } from "@/components/demo/scripted-frame"
import { useScriptedAsks } from "@/components/demo/use-scripted-asks"
import { mockupAsks } from "@/lib/components/mockup-asks"

const asks = mockupAsks["share-link"]

export function ShareLinkMockup() {
  const scripted = useScriptedAsks()
  const shared = scripted.has(asks.kavya) || scripted.has(asks.tableOnly)
  const tableOnly = scripted.has(asks.tableOnly)

  return (
    <ScriptedFrame
      label="shared view"
      asks={Object.values(asks)}
      scripted={scripted}
    >
      <div className="flex flex-col gap-3 text-sm">
        <p className="rounded-xl border p-3">
          All orders: largest first, only overdue in the South
        </p>
        {shared && (
          <div className="flex flex-col gap-1 rounded-xl border p-3">
            <code className="truncate text-xs">
              https://app.saffronsupply.example/orders?view=7KQ2M9
              {tableOnly ? "&node=orders-table" : ""}
            </code>
            <span className="text-muted-foreground">
              {tableOnly
                ? "Shares the table's changes only. "
                : "Shares this page's changes. "}
              Kavya Reddy sees them as a preview she can keep or discard.
            </span>
          </div>
        )}
        {scripted.has(asks.keep) && (
          <p className="text-muted-foreground">
            Kept. The shared view is now one of your own changes.
          </p>
        )}
      </div>
    </ScriptedFrame>
  )
}
