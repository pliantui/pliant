"use client"

import type { Column, RowData } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"

import type { PliantDataTableFeatures } from "./pliant-data-table-features"

/**
 * A column header that sorts the column when pressed, and shows its
 * direction. It shows the column's `meta.label`. Use it as a column's
 * `header`.
 */
function PliantDataTableColumnHeader<TData extends RowData, TValue>({
  column,
}: {
  column: Column<PliantDataTableFeatures, TData, TValue>
}) {
  const sorted = column.getIsSorted()

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2.5"
      onClick={() => {
        column.toggleSorting(sorted === "asc")
      }}
    >
      {column.columnDef.meta?.label}
      {sorted === "asc" ? (
        <ArrowUp />
      ) : sorted === "desc" ? (
        <ArrowDown />
      ) : (
        <ChevronsUpDown className="text-muted-foreground" />
      )}
    </Button>
  )
}

export { PliantDataTableColumnHeader }
