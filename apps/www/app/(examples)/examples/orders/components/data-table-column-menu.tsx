"use client"

import { ChevronDown } from "lucide-react"

import type { Expression, Format, Op } from "@pliantui/contract"
import { usePliantStore, useResolved } from "@pliantui/react"

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

export function DataTableColumnMenu({ node }: { node: string }) {
  const store = usePliantStore()
  // Whether the op is there, not whether its column shows: an op whose
  // column can't be computed stays in the layer.
  const added = useResolved((resolved) =>
    columns
      .filter(({ id }) => resolved.properties.get(node)?.has(`derived.${id}`))
      .map(({ id }) => id)
      .join()
  ).split(",")

  function toggle({ id, label, expr, format }: DerivedColumn) {
    const op: Op = added.includes(id)
      ? { op: "removeUserItem", target: node, id }
      : { op: "addDerived", target: node, id, label, expr, format }
    const result = store.applyOps("personal", [op])
    if (!result.success) {
      console.error(result.error)
    }
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
            checked={added.includes(column.id)}
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
