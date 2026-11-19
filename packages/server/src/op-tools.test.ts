import { describe, expect, it } from "vitest"

import type { AskContext } from "./ask-request"
import { createOpTools } from "./op-tools"

const table: AskContext = {
  manifest: {
    kind: "data-table",
    version: 1,
    description: "A table of orders",
    capabilities: { data: true, hideable: true, slots: true },
  },
  collection: {
    name: "columns",
    items: [{ id: "id" }, { id: "value" }, { id: "notes" }],
  },
  fields: [
    { id: "status", type: "enum", values: ["paid", "overdue"] },
    { id: "value", type: "number" },
  ],
}

const region: AskContext = {
  manifest: {
    kind: "region",
    version: 1,
    description: "Metric cards",
    capabilities: { slots: true, hideable: true, layout: true },
  },
  collection: {
    name: "slots",
    items: [{ id: "revenue" }, { id: "overdue" }],
  },
}

function expand(context: AskContext, name: string, input: unknown) {
  const tool = createOpTools(
    context === table ? "orders-table" : "key-metrics",
    context
  ).find((candidate) => candidate.name === name)
  if (!tool) {
    throw new Error(`No ${name} tool`)
  }
  return tool.expand(input)
}

function names(context: AskContext) {
  return createOpTools("orders-table", context).map(({ name }) => name)
}

describe("createOpTools", () => {
  it("builds the tools a table's capabilities allow", () => {
    expect(names(table)).toEqual([
      "setSort",
      "setFilter",
      "clearFilter",
      "setVisible",
      "move",
      "pin",
      "setColumnWidth",
    ])
  })

  it("builds the tools a region's capabilities allow", () => {
    expect(names(region)).toEqual(["setVisible", "move", "pin", "setLayout"])
  })

  it.each<[string, AskContext["manifest"]["capabilities"], string[]]>([
    [
      "data only",
      { data: true },
      ["setSort", "setFilter", "clearFilter", "setColumnWidth"],
    ],
    ["hideable only", { hideable: true }, ["setVisible"]],
    ["slots only", { slots: true }, ["move", "pin"]],
    ["layout only", { layout: true }, ["setLayout"]],
    ["a disabled capability", { data: false, label: true }, []],
  ])("builds only the tools for %s", (_, capabilities, expected) => {
    expect(
      names({ ...table, manifest: { ...table.manifest, capabilities } })
    ).toEqual(expected)
  })

  it("leaves out item tools without a collection and data tools without fields", () => {
    expect(names({ manifest: table.manifest })).toEqual([])
  })

  it("only offers the real ids", () => {
    expect(
      expand(table, "setVisible", {
        items: ["customer"],
        visible: false,
        explain: "Hid customer.",
      })
    ).toMatchObject({ success: false })
    expect(
      expand(table, "setSort", {
        sort: [{ field: "notes", dir: "asc" }],
        explain: "Sorted.",
      })
    ).toMatchObject({ success: false })
  })
})

describe("expansion", () => {
  it.each<[string, AskContext, string, object, object[]]>([
    [
      "setSort",
      table,
      "setSort",
      { sort: [{ field: "value", dir: "desc" }] },
      [
        {
          op: "setSort",
          target: "orders-table",
          sort: [{ field: "value", dir: "desc" }],
        },
      ],
    ],
    [
      "setFilter",
      table,
      "setFilter",
      { field: "status", operator: "eq", value: "overdue" },
      [
        {
          op: "setFilter",
          target: "orders-table",
          filter: { field: "status", operator: "eq", value: "overdue" },
        },
      ],
    ],
    [
      "setFilter with between",
      table,
      "setFilter",
      { field: "value", operator: "between", value: [10, 20] },
      [
        {
          op: "setFilter",
          target: "orders-table",
          filter: { field: "value", operator: "between", value: [10, 20] },
        },
      ],
    ],
    [
      "clearFilter",
      table,
      "clearFilter",
      { field: "status" },
      [{ op: "clearFilter", target: "orders-table", field: "status" }],
    ],
    [
      "setVisible on columns",
      table,
      "setVisible",
      { items: ["notes", "value", "notes"], visible: false },
      [
        { op: "hide", target: "orders-table/columns/notes" },
        { op: "hide", target: "orders-table/columns/value" },
      ],
    ],
    [
      "setVisible on slots",
      region,
      "setVisible",
      { items: ["overdue"], visible: true },
      [{ op: "show", target: "key-metrics/slots/overdue" }],
    ],
    [
      "move a column",
      table,
      "move",
      { item: "value", to: { before: "id" } },
      [
        {
          op: "move",
          target: "orders-table/columns/value",
          to: { before: "id" },
        },
      ],
    ],
    [
      "move a slot",
      region,
      "move",
      { item: "overdue", to: { index: 0 } },
      [{ op: "move", target: "key-metrics/slots/overdue", to: { index: 0 } }],
    ],
    [
      "pin",
      table,
      "pin",
      { item: "id", where: "start" },
      [{ op: "pin", target: "orders-table/columns/id", where: "start" }],
    ],
    [
      "setColumnWidth",
      table,
      "setColumnWidth",
      { column: "notes", width: 240 },
      [
        {
          op: "setColumnWidth",
          target: "orders-table/columns/notes",
          width: 240,
        },
      ],
    ],
    [
      "setLayout as a grid",
      region,
      "setLayout",
      { mode: "grid", columns: 2 },
      [{ op: "setLayout", target: "key-metrics", mode: "grid", columns: 2 }],
    ],
    [
      "setLayout as a row",
      region,
      "setLayout",
      { mode: "row", align: "center" },
      [
        {
          op: "setLayout",
          target: "key-metrics",
          mode: "row",
          align: "center",
        },
      ],
    ],
  ])("expands %s", (_, context, name, input, ops) => {
    expect(expand(context, name, { ...input, explain: "Changed it." })).toEqual(
      {
        success: true,
        ops,
        explain: ops.map(() => "Changed it."),
      }
    )
  })

  it.each<[string, AskContext, string, object]>([
    ["a missing explain", table, "pin", { item: "id", where: "start" }],
    [
      "columns outside a grid",
      region,
      "setLayout",
      { mode: "row", columns: 2, explain: "Row." },
    ],
    [
      "a filter value of the wrong shape",
      table,
      "setFilter",
      { field: "value", operator: "between", value: 10, explain: "Filtered." },
    ],
    [
      "an index past the last item",
      region,
      "move",
      { item: "overdue", to: { index: 2 }, explain: "Moved." },
    ],
  ])("rejects %s with an error to repair", (_, context, name, input) => {
    const result = expand(context, name, input)
    expect(result.success).toBe(false)
    expect(!result.success && result.error.length).toBeGreaterThan(0)
  })
})
