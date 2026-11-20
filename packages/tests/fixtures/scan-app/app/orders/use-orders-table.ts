import { usePliantTable } from "@pliantui/react/table"

import { columns } from "./columns"

const nodeId = "orders-table"

export function useOrdersTable() {
  return usePliantTable({ data: [], columns, features: {} }, { id: nodeId })
}
