"use client"

import {
  ScriptedFrame,
  useScriptedAsks,
} from "@/components/demo/scripted-frame"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { mockupAsks } from "@/lib/components/mockup-asks"

const asks = mockupAsks.actions

export function ActionsMockup() {
  const scripted = useScriptedAsks()
  const exportOnToolbar = scripted.has(asks.exportToToolbar)
  const invoiceInMenu = scripted.has(asks.invoiceToMenu)
  const shortcut = scripted.has(asks.bindExport)
  const duplicate = !scripted.has(asks.hideDuplicate)
  const toolbar = [
    !invoiceInMenu && "Send GST invoice",
    duplicate && "Duplicate",
    exportOnToolbar && "Export",
  ].filter((action): action is string => typeof action === "string")
  const menu = [
    invoiceInMenu && "Send GST invoice",
    !exportOnToolbar && "Export",
    "Archive",
  ].filter((action): action is string => typeof action === "string")

  return (
    <ScriptedFrame
      label="order actions"
      asks={Object.values(asks)}
      scripted={scripted}
    >
      <div className="flex flex-col gap-3">
        <div
          aria-label="Order actions"
          role="group"
          className="flex flex-wrap items-center gap-2"
        >
          {toolbar.map((action) => (
            <Button key={action} type="button" variant="outline" size="sm">
              {action}
              {action === "Export" && shortcut && <Kbd>⌘⇧E</Kbd>}
            </Button>
          ))}
        </div>
        <div className="w-56 rounded-lg border p-1 text-sm shadow-sm">
          <p className="px-2 py-1 text-xs text-muted-foreground">
            More actions
          </p>
          <ul>
            {menu.map((action) => (
              <li
                key={action}
                className="flex items-center justify-between rounded-sm px-2 py-1.5"
              >
                {action}
                {action === "Export" && shortcut && <Kbd>⌘⇧E</Kbd>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ScriptedFrame>
  )
}
