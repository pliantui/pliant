"use client"

import { ChevronDown } from "lucide-react"

import type { Expression, Format, Op } from "@pliantui/contract"
import { usePliantStore } from "@pliantui/react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const gst: Format = { type: "currency", currency: "INR", decimals: 0 }
const percent: Format = { type: "percent", decimals: 1 }

interface DerivedColumn {
  id: string
  label: string
  expr: Expression
  format: Format
}

const columns: DerivedColumn[] = [
  {
    id: "value-with-gst",
    label: "Value with GST",
    expr: { fn: "mul", args: [{ field: "value" }, { value: 1.18 }] },
    format: gst,
  },
  {
    id: "value-share",
    label: "Share of value",
    expr: { fn: "share", args: [{ field: "value" }] },
    format: percent,
  },
]

export function DataTableColumnMenu({
  node,
  columnIds,
}: {
  node: string
  columnIds: readonly string[]
}) {
  const store = usePliantStore()

  function toggle({ id, label, expr, format }: DerivedColumn) {
    const op: Op = columnIds.includes(id)
      ? { op: "removeUserItem", target: node, id }
      : { op: "addDerived", target: node, id, label, expr, format }
    store.applyOps("personal", [op])
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          Add column <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={columnIds.includes(column.id)}
            onCheckedChange={() => {
              toggle(column)
            }}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
