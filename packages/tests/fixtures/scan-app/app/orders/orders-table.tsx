"use client"

import { useTable } from "@tanstack/react-table"

import { usePliantTable } from "@pliantui/react/table"

import { columns } from "./columns"

const nodeId = "orders-table"

export function OrdersTable() {
  const options = usePliantTable(
    { data: [], columns, features: {} },
    { id: nodeId }
  )
  const table = useTable(options)
  return <table>{table.getRowCount()}</table>
}
