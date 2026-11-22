"use client"

import { MoreHorizontalIcon } from "lucide-react"

import {
  ScriptedFrame,
  useScriptedAsks,
} from "@/components/demo/scripted-frame"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"

const asks = [
  "put export on the toolbar",
  "move send gst invoice to the menu",
  "bind e to export",
  "hide duplicate",
]

export function ActionsMockup() {
  const scripted = useScriptedAsks()
  const exportOnToolbar = scripted.has(asks[0] ?? "")
  const invoiceInMenu = scripted.has(asks[1] ?? "")
  const shortcut = scripted.has(asks[2] ?? "")
  const duplicate = !scripted.has(asks[3] ?? "")
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
    <ScriptedFrame label="order actions" asks={asks} scripted={scripted}>
      <div className="flex flex-col gap-3">
        <div
          role="toolbar"
          aria-label="Order actions"
          className="flex flex-wrap items-center gap-2"
        >
          {toolbar.map((action) => (
            <Button key={action} type="button" variant="outline" size="sm">
              {action}
              {action === "Export" && shortcut && <Kbd>E</Kbd>}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="More actions"
          >
            <MoreHorizontalIcon />
          </Button>
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
                {action === "Export" && shortcut && <Kbd>E</Kbd>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ScriptedFrame>
  )
}
