"use client"

import type { Column, RowData } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"

import type { OrdersTableFeatures } from "./table-features"

export function ColumnHeader<TData extends RowData, TValue>({
  column,
  title,
}: {
  column: Column<OrdersTableFeatures, TData, TValue>
  title: string
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
      {title}
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
