import { describe, expect, it } from "vitest"

import { opCatalog, opSchema, type Op, type OpName } from "@pliantui/contract"

import { opProperties, type OpProperty } from "./op-property"

const expr = { field: "total" }
const table = "orders-table"
const exportAction = "orders-toolbar/actions/export"

const cases: [Op, OpProperty[]][] = [
  [
    { op: "setProp", target: "pay-now", prop: "variant", value: "outline" },
    [{ address: "pay-now", property: "props.variant" }],
  ],
  [
    { op: "rename", target: "orders-table/columns/value", label: "Amount" },
    [{ address: "orders-table/columns/value", property: "label" }],
  ],
  [
    { op: "hide", target: "orders-table/columns/notes" },
    [{ address: "orders-table/columns/notes", property: "visible" }],
  ],
  [
    { op: "show", target: "orders-table/columns/notes" },
    [{ address: "orders-table/columns/notes", property: "visible" }],
  ],
  [
    { op: "move", target: "dashboard/slots/revenue", to: { after: "orders" } },
    [{ address: "revenue", property: "placement" }],
  ],
  [
    {
      op: "collapse",
      target: "dashboard",
      items: ["notes", "history"],
      into: "more",
    },
    [
      { address: "dashboard", property: "collapse.notes" },
      { address: "dashboard", property: "collapse.history" },
    ],
  ],
  [
    { op: "collapse", target: "dashboard", items: ["notes"], into: "none" },
    [{ address: "dashboard", property: "collapse.notes" }],
  ],
  [
    { op: "pin", target: "orders-table/columns/id", where: "start" },
    [{ address: "orders-table/columns/id", property: "placement" }],
  ],
  [
    { op: "setLayout", target: "dashboard", mode: "grid", columns: 2 },
    [{ address: "dashboard", property: "layout", breakpoint: "md" }],
  ],
  [
    { op: "span", target: "dashboard/slots/revenue", columns: 2, at: "lg" },
    [
      {
        address: "revenue",
        property: "span",
        breakpoint: "lg",
      },
    ],
  ],
  [
    {
      op: "insert",
      target: "dashboard",
      node: { id: "revenue-chart", kind: "chart", dataset: "orders" },
      at: { index: 0 },
    },
    [{ address: "revenue-chart", property: "inserted" }],
  ],
  [
    {
      op: "wrap",
      target: "dashboard",
      id: "top-row",
      items: ["revenue", "orders"],
      mode: "row",
    },
    [
      { address: "top-row", property: "inserted" },
      { address: "revenue", property: "placement" },
      { address: "orders", property: "placement" },
    ],
  ],
  [
    { op: "remove", target: "dashboard/slots/revenue-chart" },
    [{ address: "revenue-chart", property: "inserted" }],
  ],
  [
    { op: "setDefault", target: "ticket-form/fields/priority", value: "high" },
    [{ address: "ticket-form/fields/priority", property: "default" }],
  ],
  [
    {
      op: "setDefault",
      target: "settings-tabs",
      prop: "defaultValue",
      value: "activity",
    },
    [{ address: "settings-tabs", property: "defaults.defaultValue" }],
  ],
  [
    {
      op: "setDefault",
      target: "workspace/slots/panels",
      prop: "defaultSize",
      value: 35,
    },
    [{ address: "panels", property: "defaults.defaultSize" }],
  ],
  [
    { op: "setPresentation", target: "edit-order", as: "sheet", side: "end" },
    [{ address: "edit-order", property: "presentation" }],
  ],
  [
    { op: "setSize", target: "edit-order", size: "lg" },
    [{ address: "edit-order", property: "size" }],
  ],
  [
    { op: "setLanding", target: "app-sidebar/items/reports" },
    [{ address: "app-sidebar", property: "landing" }],
  ],
  [
    { op: "promote", target: exportAction },
    [{ address: exportAction, property: "placement" }],
  ],
  [
    { op: "demote", target: exportAction },
    [{ address: exportAction, property: "placement" }],
  ],
  [
    { op: "bindShortcut", target: exportAction, keys: "mod+e" },
    [{ address: exportAction, property: "shortcut" }],
  ],
  [
    { op: "setSort", target: table, sort: [{ field: "total", dir: "desc" }] },
    [{ address: table, property: "sort" }],
  ],
  [
    {
      op: "setFilter",
      target: table,
      filter: { field: "status", operator: "eq", value: "open" },
    },
    [{ address: table, property: "filter.status" }],
  ],
  [
    { op: "clearFilter", target: table, field: "status" },
    [{ address: table, property: "filter.status" }],
  ],
  [
    { op: "setPage", target: table, index: 2, size: 50 },
    [{ address: table, property: "page" }],
  ],
  [
    { op: "setGroupBy", target: table, fields: ["status"] },
    [{ address: table, property: "groupBy" }],
  ],
  [
    { op: "addDerived", target: table, id: "margin", label: "Margin", expr },
    [{ address: table, property: "derived.margin" }],
  ],
  [
    {
      op: "addAggregate",
      target: table,
      id: "sum",
      label: "Sum",
      expr: { fn: "sum", args: [expr] },
    },
    [{ address: table, property: "aggregate.sum" }],
  ],
  [
    {
      op: "formatField",
      target: table,
      field: "total",
      format: { type: "currency", currency: "USD" },
    },
    [{ address: table, property: "format.total" }],
  ],
  [
    {
      op: "addHighlight",
      target: table,
      id: "late",
      when: expr,
      tone: "warning",
    },
    [{ address: table, property: "highlight.late" }],
  ],
  [
    {
      op: "addSortOption",
      target: table,
      id: "newest",
      label: "Newest",
      sort: [{ field: "created", dir: "desc" }],
    },
    [{ address: table, property: "sortOption.newest" }],
  ],
  [
    {
      op: "addFilterControl",
      target: table,
      id: "status-filter",
      field: "status",
      control: "select",
    },
    [{ address: table, property: "filterControl.status-filter" }],
  ],
  [
    {
      op: "addPreset",
      target: table,
      id: "open",
      label: "Open",
      filters: [{ field: "status", operator: "eq", value: "open" }],
    },
    [{ address: table, property: "preset.open" }],
  ],
  [
    { op: "setViewKind", target: table, kind: "chart" },
    [{ address: table, property: "viewKind" }],
  ],
  [
    {
      op: "configureChart",
      target: table,
      type: "bar",
      x: "month",
      y: ["total"],
    },
    [{ address: table, property: "chart" }],
  ],
  [
    { op: "configureStat", target: "revenue", metric: "total" },
    [{ address: "revenue", property: "stat" }],
  ],
  [
    { op: "removeUserItem", target: table, id: "margin" },
    [
      { address: table, property: "derived.margin" },
      { address: table, property: "aggregate.margin" },
      { address: table, property: "highlight.margin" },
      { address: table, property: "sortOption.margin" },
      { address: table, property: "filterControl.margin" },
      { address: table, property: "preset.margin" },
    ],
  ],
  [
    { op: "setColumnWidth", target: "orders-table/columns/notes", width: 240 },
    [{ address: "orders-table/columns/notes", property: "width" }],
  ],
  [
    { op: "setDensity", target: "@surface", density: "compact" },
    [{ address: "@surface", property: "density" }],
  ],
  [
    { op: "setTextScale", target: "@app", scale: 1.25 },
    [{ address: "@app", property: "textScale" }],
  ],
  [
    { op: "setMotion", target: "@app", motion: "reduced" },
    [{ address: "@app", property: "motion" }],
  ],
]

describe("opProperties", () => {
  it("covers every op in the catalog", () => {
    const names = new Set<OpName>(cases.map(([op]) => op.op))
    expect([...names].sort()).toEqual(Object.keys(opCatalog).sort())
  })

  it.each(cases)("maps %j to %j", (op, properties) => {
    expect(opSchema.safeParse(op).success).toBe(true)
    expect(opProperties(op)).toEqual(properties)
  })

  it("never writes an ext. property, even for keys named ext", () => {
    const named: Op[] = [
      { op: "setProp", target: "pay-now", prop: "ext", value: "outline" },
      { op: "collapse", target: "dashboard", items: ["ext"], into: "more" },
      { op: "clearFilter", target: table, field: "ext" },
      {
        op: "formatField",
        target: table,
        field: "ext",
        format: { type: "currency", currency: "USD" },
      },
      { op: "removeUserItem", target: table, id: "ext" },
    ]
    const properties = [...cases.map(([op]) => op), ...named].flatMap((op) =>
      opProperties(op).map(({ property }) => property)
    )
    expect(
      properties.filter((property) => property.startsWith("ext."))
    ).toEqual([])
  })

  it.each([
    [undefined, "md"],
    ["md", "md"],
    ["base", "base"],
    ["2xl", "2xl"],
  ] as const)("reads setLayout at %s as breakpoint %s", (at, breakpoint) => {
    const op: Op = {
      op: "setLayout",
      target: "dashboard",
      mode: "stack",
      ...(at === undefined ? {} : { at }),
    }
    expect(opProperties(op)).toEqual([
      { address: "dashboard", property: "layout", breakpoint },
    ])
  })

  it.each([
    [undefined, "md"],
    ["sm", "sm"],
  ] as const)("reads span at %s as breakpoint %s", (at, breakpoint) => {
    const op: Op = {
      op: "span",
      target: "dashboard/slots/a",
      columns: 2,
      ...(at === undefined ? {} : { at }),
    }
    expect(opProperties(op)).toEqual([
      { address: "a", property: "span", breakpoint },
    ])
  })

  it("keys setLanding on the nav node that holds the item", () => {
    expect(
      opProperties({
        op: "setLanding",
        target: "shell/slots/app-sidebar/items/reports",
      })
    ).toEqual([{ address: "app-sidebar", property: "landing" }])
  })

  it("keys a wrapper on its own id, even inside another node", () => {
    expect(
      opProperties({
        op: "wrap",
        target: "page/slots/dashboard",
        id: "top-row",
        items: ["a", "b"],
        mode: "grid",
        columns: 2,
      })
    ).toEqual([
      { address: "top-row", property: "inserted" },
      { address: "a", property: "placement" },
      { address: "b", property: "placement" },
    ])
  })

  it.each([
    ["dashboard/slots/revenue-chart", "revenue-chart"],
    ["revenue-chart", "revenue-chart"],
    ["page/slots/dashboard/slots/top-row", "top-row"],
  ])("removes %s by its identity", (target, address) => {
    expect(opProperties({ op: "remove", target })).toEqual([
      { address, property: "inserted" },
    ])
  })

  it("keys items in other collections on their node's identity", () => {
    expect(
      opProperties({
        op: "hide",
        target: "page/slots/orders-table/columns/notes",
      })
    ).toEqual([{ address: "orders-table/columns/notes", property: "visible" }])
  })
})
