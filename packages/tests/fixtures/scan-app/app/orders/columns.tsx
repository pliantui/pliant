import { createColumnHelper } from "@tanstack/react-table"

interface Order {
  id: string
  customer: { name: string }
  value: number
  "2fa": boolean
}

const columnHelper = createColumnHelper<Order>()

export const columns = columnHelper.columns([
  columnHelper.accessor("id", { header: "Order" }),
  columnHelper.group({
    header: "Customer",
    columns: [columnHelper.accessor("customer.name", { header: "Name" })],
  }),
  columnHelper.accessor((order) => order.value * 100, {
    id: "cents",
    header: "Cents",
  }),
  columnHelper.accessor("2fa", { header: "2FA" }),
  columnHelper.display({ id: "actions", cell: () => <button>Open</button> }),
])
