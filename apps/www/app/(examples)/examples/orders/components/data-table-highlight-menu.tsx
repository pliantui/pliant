"use client"

import { ChevronDown } from "lucide-react"

import type { Expression, Op } from "@pliantui/contract"
import { usePliantStore, useResolved } from "@pliantui/react"
import type { PliantHighlight } from "@pliantui/react/table"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Highlight {
  id: string
  label: string
  when: Expression
  tone: PliantHighlight["tone"]
}

const highlights: Highlight[] = [
  {
    id: "large-orders",
    label: "Over ₹1,00,000",
    when: { fn: "gt", args: [{ field: "value" }, { value: 100000 }] },
    tone: "emphasis",
  },
  {
    id: "overdue-orders",
    label: "Overdue",
    when: { fn: "eq", args: [{ field: "status" }, { value: "overdue" }] },
    tone: "danger",
  },
  {
    id: "largest-order",
    label: "Largest in group",
    when: {
      fn: "eq",
      args: [{ fn: "rank", args: [{ field: "value" }] }, { value: 1 }],
    },
    tone: "success",
  },
]

export function formatHighlight({ id, tone }: PliantHighlight) {
  return highlights.find((highlight) => highlight.id === id)?.label ?? tone
}

export function DataTableHighlightMenu({ node }: { node: string }) {
  const store = usePliantStore()
  const added = useResolved((resolved) =>
    highlights
      .filter(({ id }) => resolved.properties.get(node)?.has(`highlight.${id}`))
      .map(({ id }) => id)
      .join()
  ).split(",")

  function toggle({ id, when, tone }: Highlight) {
    const op: Op = added.includes(id)
      ? { op: "removeUserItem", target: node, id }
      : { op: "addHighlight", target: node, id, when, tone }
    const result = store.applyOps("personal", [op])
    if (!result.success) {
      console.error(result.error)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          Highlight <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {highlights.map((highlight) => (
          <DropdownMenuCheckboxItem
            key={highlight.id}
            checked={added.includes(highlight.id)}
            onCheckedChange={() => {
              toggle(highlight)
            }}
          >
            {highlight.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
