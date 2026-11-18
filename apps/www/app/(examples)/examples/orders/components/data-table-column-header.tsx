"use client"

import type { Column, RowData } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"

import type { DataTableFeatures } from "./data-table-features"

export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
}: {
  column: Column<DataTableFeatures, TData, TValue>
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
