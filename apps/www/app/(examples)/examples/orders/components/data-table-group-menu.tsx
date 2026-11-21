"use client"

import { ChevronDown } from "lucide-react"

import type { Op } from "@pliantui/contract"
import { usePliantStore } from "@pliantui/react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const groups = [
  { value: "none", label: "None" },
  { value: "status", label: "Status" },
  { value: "region", label: "Region" },
]

export function DataTableGroupMenu({
  node,
  value,
}: {
  node: string
  value: string
}) {
  const store = usePliantStore()

  function choose(group: string) {
    const ops: Op[] =
      group === "none"
        ? [
            { op: "setGroupBy", target: node, fields: [] },
            { op: "removeUserItem", target: node, id: "total-value" },
            { op: "removeUserItem", target: node, id: "order-count" },
          ]
        : [
            { op: "setGroupBy", target: node, fields: [group] },
            {
              op: "addAggregate",
              target: node,
              id: "total-value",
              label: "Total value",
              expr: { fn: "sum", args: [{ field: "value" }] },
            },
            {
              op: "addAggregate",
              target: node,
              id: "order-count",
              label: "Orders",
              expr: { fn: "count", args: [] },
            },
          ]
    store.applyOps("personal", ops)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          Group by <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={value} onValueChange={choose}>
          {groups.map(({ value: group, label }) => (
            <DropdownMenuRadioItem key={group} value={group}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
