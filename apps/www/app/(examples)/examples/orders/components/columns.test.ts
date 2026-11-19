import { describe, expect, it } from "vitest"

import { askTargets } from "../ask-targets"
import { columns } from "./columns"

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
