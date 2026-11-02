import { describe, expect, it } from "vitest"

import { opCatalog, opSchema, type Op, type OpName } from "@pliantui/contract"

import { opProperty } from "./op-property"

const expr = { field: "total" }

const cases: [Op, string, string][] = [
  [
    { op: "setProp", target: "pay-now", prop: "variant", value: "outline" },
    "pay-now",
    "props.variant",
  ],
  [
    { op: "rename", target: "orders-table/columns/value", label: "Amount" },
    "orders-table/columns/value",
    "label",
  ],
  [
    { op: "hide", target: "orders-table/columns/notes" },
    "orders-table/columns/notes",
    "visible",
  ],
  [
    { op: "show", target: "orders-table/columns/notes" },
    "orders-table/columns/notes",
    "visible",
  ],
  [
    { op: "move", target: "dashboard/slots/revenue", to: { after: "orders" } },
    "dashboard/slots/revenue",
    "position",
  ],
  [
    { op: "collapse", target: "dashboard", items: ["notes"], into: "more" },
    "dashboard",
    "collapse",
  ],
  [
    { op: "pin", target: "orders-table/columns/id", where: "start" },
    "orders-table/columns/id",
    "pin",
  ],
  [
    { op: "setLayout", target: "dashboard", mode: "grid", columns: 2 },
    "dashboard",
    "layout.md",
  ],
  [
    { op: "span", target: "dashboard/slots/revenue", columns: 2, at: "lg" },
    "dashboard/slots/revenue",
    "span.lg",
  ],
  [
    {
      op: "insert",
      target: "dashboard",
      node: { id: "revenue-chart", kind: "chart", dataset: "orders" },
      at: { index: 0 },
    },
    "dashboard/slots/revenue-chart",
    "inserted",
  ],
  [
    {
      op: "wrap",
      target: "dashboard",
      id: "top-row",
      items: ["revenue", "orders"],
      mode: "row",
    },
    "dashboard/slots/top-row",
    "inserted",
  ],
  [
    { op: "remove", target: "dashboard/slots/revenue-chart" },
    "dashboard/slots/revenue-chart",
    "inserted",
  ],
  [
    { op: "setDefault", target: "ticket-form/fields/priority", value: "high" },
    "ticket-form/fields/priority",
    "default",
  ],
  [
    { op: "setPresentation", target: "edit-order", as: "sheet", side: "right" },
    "edit-order",
    "presentation",
  ],
  [{ op: "setSize", target: "edit-order", size: "lg" }, "edit-order", "size"],
  [
    { op: "setLanding", target: "app-sidebar/items/reports" },
    "app-sidebar",
    "landing",
  ],
  [
    { op: "promote", target: "orders-toolbar/actions/export" },
    "orders-toolbar/actions/export",
    "promoted",
  ],
  [
    { op: "demote", target: "orders-toolbar/actions/export" },
    "orders-toolbar/actions/export",
    "promoted",
  ],
  [
    {
      op: "bindShortcut",
      target: "orders-toolbar/actions/export",
      keys: "mod+e",
    },
    "orders-toolbar/actions/export",
    "shortcut",
  ],
  [
    {
      op: "setSort",
      target: "orders-table",
      sort: [{ field: "total", dir: "desc" }],
    },
    "orders-table",
    "sort",
  ],
  [
    {
      op: "setFilter",
      target: "orders-table",
      filter: { field: "status", operator: "eq", value: "open" },
    },
    "orders-table",
    "filter.status",
  ],
  [
    { op: "clearFilter", target: "orders-table", field: "status" },
    "orders-table",
    "filter.status",
  ],
  [
    { op: "setPage", target: "orders-table", index: 2, size: 50 },
    "orders-table",
    "page",
  ],
  [
    { op: "setGroupBy", target: "orders-table", fields: ["status"] },
    "orders-table",
    "groupBy",
  ],
  [
    {
      op: "addDerived",
      target: "orders-table",
      id: "margin",
      label: "Margin",
      expr,
    },
    "orders-table",
    "userItems.margin",
  ],
  [
    {
      op: "addAggregate",
      target: "orders-table",
      id: "sum",
      label: "Sum",
      expr: { fn: "sum", args: [expr] },
    },
    "orders-table",
    "userItems.sum",
  ],
  [
    {
      op: "formatField",
      target: "orders-table",
      field: "total",
      format: { type: "currency", currency: "USD" },
    },
    "orders-table",
    "format.total",
  ],
  [
    {
      op: "addHighlight",
      target: "orders-table",
      id: "late",
      when: expr,
      tone: "warning",
    },
    "orders-table",
    "userItems.late",
  ],
  [
    {
      op: "addSortOption",
      target: "orders-table",
      id: "newest",
      label: "Newest",
      sort: [{ field: "created", dir: "desc" }],
    },
    "orders-table",
    "userItems.newest",
  ],
  [
    {
      op: "addFilterControl",
      target: "orders-table",
      id: "status-filter",
      field: "status",
      control: "select",
    },
    "orders-table",
    "userItems.status-filter",
  ],
  [
    {
      op: "addPreset",
      target: "orders-table",
      id: "open",
      label: "Open",
      filters: [{ field: "status", operator: "eq", value: "open" }],
    },
    "orders-table",
    "userItems.open",
  ],
  [
    { op: "setViewKind", target: "orders-table", kind: "chart" },
    "orders-table",
    "viewKind",
  ],
  [
    {
      op: "configureChart",
      target: "orders-table",
      type: "bar",
      x: "month",
      y: ["total"],
    },
    "orders-table",
    "chart",
  ],
  [
    { op: "configureStat", target: "revenue", metric: "total" },
    "revenue",
    "stat",
  ],
  [
    { op: "removeUserItem", target: "orders-table", id: "margin" },
    "orders-table",
    "userItems.margin",
  ],
  [
    { op: "setColumnWidth", target: "orders-table/columns/notes", width: 240 },
    "orders-table/columns/notes",
    "width",
  ],
  [
    { op: "setDensity", target: "@surface", density: "compact" },
    "@surface",
    "density",
  ],
  [{ op: "setTextScale", target: "@app", scale: 1.25 }, "@app", "textScale"],
  [{ op: "setMotion", target: "@app", motion: "reduced" }, "@app", "motion"],
]

describe("opProperty", () => {
  it("covers every op in the catalog", () => {
    const names = new Set<OpName>(cases.map(([op]) => op.op))
    expect([...names].sort()).toEqual(Object.keys(opCatalog).sort())
  })

  it.each(cases)("maps %j to %s %s", (op, address, property) => {
    expect(opSchema.safeParse(op).success).toBe(true)
    expect(opProperty(op)).toEqual({ address, property })
  })

  it.each([
    [undefined, "layout.md"],
    ["md", "layout.md"],
    ["base", "layout.base"],
    ["2xl", "layout.2xl"],
  ] as const)("keys setLayout at %s as %s", (at, property) => {
    const op: Op = {
      op: "setLayout",
      target: "dashboard",
      mode: "stack",
      ...(at === undefined ? {} : { at }),
    }
    expect(opProperty(op).property).toBe(property)
  })

  it.each([
    [undefined, "span.md"],
    ["sm", "span.sm"],
  ] as const)("keys span at %s as %s", (at, property) => {
    const op: Op = {
      op: "span",
      target: "dashboard/slots/a",
      columns: 2,
      ...(at === undefined ? {} : { at }),
    }
    expect(opProperty(op).property).toBe(property)
  })

  it("keys setLanding on the nav node that holds the item", () => {
    expect(
      opProperty({
        op: "setLanding",
        target: "shell/slots/app-sidebar/items/reports",
      }).address
    ).toBe("shell/slots/app-sidebar")
  })
})
