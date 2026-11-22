import { describe, expect, it } from "vitest"

import { columns } from "@/registry/blocks/orders-list/columns"

import { askTargets } from "./ask-targets"

describe("columns", () => {
  it("are the columns the orders-table ask target describes", () => {
    const target = askTargets.find(({ id }) => id === "orders-table")

    expect(
      columns.map((column) => ({
        id: "accessorKey" in column ? column.accessorKey : column.id,
        label: column.meta?.label,
      }))
    ).toEqual(target?.context.collection.items)
  })
})
