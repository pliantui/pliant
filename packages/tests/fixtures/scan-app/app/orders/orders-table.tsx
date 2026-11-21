"use client"

import { useTable } from "@tanstack/react-table"

import { useOrdersTable } from "./use-orders-table"

export function OrdersTable() {
  const options = useOrdersTable()
  const table = useTable(options)
  return <table>{table.getRowCount()}</table>
}
