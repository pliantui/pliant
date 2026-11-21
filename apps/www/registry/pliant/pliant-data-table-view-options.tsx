"use client"

import type { ReactTable, RowData } from "@tanstack/react-table"
import { ChevronDown } from "lucide-react"

import { usePliantMessages, type PliantMessages } from "@pliantui/react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import type { PliantDataTableFeatures } from "./pliant-data-table-features"

declare module "@pliantui/react" {
  interface PliantMessages {
    dataTableColumns: string
  }
}

const viewOptionsMessages = {
  dataTableColumns: "Columns",
} satisfies Partial<PliantMessages>

/**
 * A menu of the table's columns that users can show or hide. It lists the
 * columns that can be hidden, by their `meta.label`.
 */
function PliantDataTableViewOptions<TData extends RowData>({
  table,
}: {
  /** The table from `useTable`, with the options from `usePliantTable`. */
  table: ReactTable<PliantDataTableFeatures, TData>
}) {
  const messages = usePliantMessages(viewOptionsMessages)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {messages.dataTableColumns} <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {table
          .getAllColumns()
          .filter((column) => column.getCanHide())
          .map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(value) => {
                column.toggleVisibility(value)
              }}
            >
              {column.columnDef.meta?.label}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { PliantDataTableViewOptions }
