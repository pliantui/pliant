import { describe, expect, it, vi } from "vitest"

import {
  compileTableState,
  type CompileTableStateOptions,
} from "./compile-table-state"
import { loadOverlay, type LoadedOverlay } from "./load-overlay"
import { resolveLayers, type ResolvedLayers } from "./resolve-layers"

const table = "orders-table"
const columns = [
  "id",
  "customer",
  "region",
  "status",
  "value",
  "createdAt",
  "notes",
]

const column = (id: string) => `${table}/columns/${id}`

function overlay(
  layer: "team" | "personal",
  ops: unknown[],
  id = "01JBQ3V8Z7XKQ2M4N5P6R7S800"
): LoadedOverlay {
  const result = loadOverlay({
    v: 1,
    id,
    surface: "/orders",
    layer,
    ...(layer === "team" && { scope: { team: "sales" } }),
    ops,
    basis: { contract: 1, core: "0.1.0", manifests: {} },
    source: "manual",
    createdBy: "user_123",
    createdAt: "2026-11-01T09:30:00.000Z",
  })
  if (!result.success) {
    throw result.error
  }
  return result.data
}

function compile(
  ops: unknown[],
  options: Partial<CompileTableStateOptions> = {},
  lower: unknown[] = []
) {
  const resolved = resolveLayers(
    [
      ...(lower.length > 0
        ? [overlay("team", lower, "01JBQ3V8Z7XKQ2M4N5P6R7S801")]
        : []),
      overlay("personal", ops),
    ],
    { surface: "/orders" }
  )
  return compileTableState(resolved, { table, columns, ...options })
}

describe("compileTableState", () => {
  it("compiles no ops into empty state in base order", () => {
    expect(compile([{ op: "rename", target: table, label: "Orders" }]))
      .toMatchInlineSnapshot(`
      {
        "columnFilters": [],
        "columnOrder": [
          "id",
          "customer",
          "region",
          "status",
          "value",
          "createdAt",
          "notes",
        ],
        "columnPinning": {
          "end": [],
          "start": [],
        },
        "columnSizing": {},
        "columnVisibility": {},
        "sorting": [],
      }
    `)
  })

  describe("setSort", () => {
    it("compiles the sort list", () => {
      expect(
        compile([
          {
            op: "setSort",
            target: table,
            sort: [
              { field: "value", dir: "desc" },
              { field: "createdAt", dir: "asc" },
            ],
          },
        ]).sorting
      ).toMatchInlineSnapshot(`
        [
          {
            "desc": true,
            "id": "value",
          },
          {
            "desc": false,
            "id": "createdAt",
          },
        ]
      `)
    })

    it("replaces a lower layer's whole sort", () => {
      expect(
        compile(
          [
            {
              op: "setSort",
              target: table,
              sort: [{ field: "customer", dir: "asc" }],
            },
          ],
          {},
          [
            {
              op: "setSort",
              target: table,
              sort: [{ field: "value", dir: "desc" }],
            },
          ]
        ).sorting
      ).toMatchInlineSnapshot(`
        [
          {
            "desc": false,
            "id": "customer",
          },
        ]
      `)
    })

    it("compiles an empty sort, and leaves out fields that aren't columns", () => {
      expect(
        compile([
          {
            op: "setSort",
            target: table,
            sort: [
              { field: "margin", dir: "asc" },
              { field: "status", dir: "asc" },
            ],
          },
        ]).sorting
      ).toMatchInlineSnapshot(`
        [
          {
            "desc": false,
            "id": "status",
          },
        ]
      `)
      expect(
        compile([{ op: "setSort", target: table, sort: [] }]).sorting
      ).toEqual([])
    })
  })

  describe("hide and show", () => {
    it("compiles column visibility", () => {
      expect(
        compile([
          { op: "hide", target: column("notes") },
          { op: "hide", target: column("region") },
          { op: "show", target: column("region") },
        ]).columnVisibility
      ).toMatchInlineSnapshot(`
        {
          "notes": false,
          "region": true,
        }
      `)
    })

    it("shows a column a lower layer hid", () => {
      expect(
        compile([{ op: "show", target: column("notes") }], {}, [
          { op: "hide", target: column("notes") },
        ]).columnVisibility
      ).toMatchInlineSnapshot(`
        {
          "notes": true,
        }
      `)
    })

    it("accepts the table's slot address", () => {
      expect(
        compile([{ op: "hide", target: `page/slots/${column("notes")}` }], {
          table: `page/slots/${table}`,
        }).columnVisibility
      ).toEqual({ notes: false })
    })
  })

  describe("move", () => {
    it("moves a column before another", () => {
      expect(
        compile([
          { op: "move", target: column("notes"), to: { before: "customer" } },
        ]).columnOrder
      ).toMatchInlineSnapshot(`
        [
          "id",
          "notes",
          "customer",
          "region",
          "status",
          "value",
          "createdAt",
        ]
      `)
    })

    it("moves a column after another", () => {
      expect(
        compile([{ op: "move", target: column("id"), to: { after: "status" } }])
          .columnOrder
      ).toMatchInlineSnapshot(`
        [
          "customer",
          "region",
          "status",
          "id",
          "value",
          "createdAt",
          "notes",
        ]
      `)
    })

    it("moves a column to an index", () => {
      expect(
        compile([{ op: "move", target: column("value"), to: { index: 0 } }])
          .columnOrder
      ).toMatchInlineSnapshot(`
        [
          "value",
          "id",
          "customer",
          "region",
          "status",
          "createdAt",
          "notes",
        ]
      `)
    })

    it("resolves anchors against hidden columns", () => {
      const state = compile([
        { op: "move", target: column("value"), to: { after: "notes" } },
        { op: "hide", target: column("notes") },
      ])
      expect(state.columnOrder).toMatchInlineSnapshot(`
        [
          "id",
          "customer",
          "region",
          "status",
          "createdAt",
          "notes",
          "value",
        ]
      `)
      expect(state.columnVisibility).toEqual({ notes: false })
    })

    it("keeps a lower layer's move under a higher layer's", () => {
      expect(
        compile(
          [{ op: "move", target: column("notes"), to: { after: "id" } }],
          {},
          [
            { op: "move", target: column("notes"), to: { index: 0 } },
            { op: "move", target: column("status"), to: { before: "notes" } },
          ]
        ).columnOrder
      ).toMatchInlineSnapshot(`
        [
          "id",
          "status",
          "notes",
          "customer",
          "region",
          "value",
          "createdAt",
        ]
      `)
    })
  })

  describe("pin", () => {
    it("pins columns to the start and the end", () => {
      const state = compile([
        { op: "pin", target: column("notes"), where: "start" },
        { op: "pin", target: column("customer"), where: "start" },
        { op: "pin", target: column("id"), where: "end" },
      ])
      expect(state.columnPinning).toMatchInlineSnapshot(`
        {
          "end": [
            "id",
          ],
          "start": [
            "customer",
            "notes",
          ],
        }
      `)
      expect(state.columnOrder).toMatchInlineSnapshot(`
        [
          "customer",
          "notes",
          "region",
          "status",
          "value",
          "createdAt",
          "id",
        ]
      `)
    })

    it("pins a sticky column to the start", () => {
      expect(
        compile([{ op: "pin", target: column("status"), where: "sticky" }])
          .columnPinning
      ).toEqual({ start: ["status"], end: [] })
    })

    it("unpins a column a lower layer pinned", () => {
      const state = compile(
        [{ op: "pin", target: column("notes"), where: "none" }],
        {},
        [{ op: "pin", target: column("notes"), where: "end" }]
      )
      expect(state.columnPinning).toMatchInlineSnapshot(`
        {
          "end": [],
          "start": [],
        }
      `)
      expect(state.columnOrder).toEqual(columns)
    })
  })

  describe("setColumnWidth", () => {
    it("compiles column sizing", () => {
      expect(
        compile([
          { op: "setColumnWidth", target: column("notes"), width: 320 },
          { op: "setColumnWidth", target: column("id"), width: 80 },
        ]).columnSizing
      ).toMatchInlineSnapshot(`
        {
          "id": 80,
          "notes": 320,
        }
      `)
    })

    it("clamps widths to the column's size limits", () => {
      expect(
        compile(
          [
            { op: "setColumnWidth", target: column("notes"), width: 1200 },
            { op: "setColumnWidth", target: column("id"), width: 16 },
            { op: "setColumnWidth", target: column("value"), width: 140 },
          ],
          {
            sizeLimits: {
              notes: { maxSize: 480 },
              id: { minSize: 60, maxSize: 120 },
              value: { minSize: 100, maxSize: 200 },
            },
          }
        ).columnSizing
      ).toMatchInlineSnapshot(`
        {
          "id": 60,
          "notes": 480,
          "value": 140,
        }
      `)
    })
  })

  describe("setFilter and clearFilter", () => {
    it("compiles each operator's value", () => {
      expect(
        compile([
          {
            op: "setFilter",
            target: table,
            filter: { field: "value", operator: "between", value: [100, 500] },
          },
          {
            op: "setFilter",
            target: table,
            filter: {
              field: "status",
              operator: "in",
              value: ["open", "paid"],
            },
          },
          {
            op: "setFilter",
            target: table,
            filter: { field: "notes", operator: "isNull" },
          },
          {
            op: "setFilter",
            target: table,
            filter: { field: "customer", operator: "contains", value: "acme" },
          },
          {
            op: "setFilter",
            target: table,
            filter: { field: "margin", operator: "gt", value: 0 },
          },
        ]).columnFilters
      ).toMatchInlineSnapshot(`
        [
          {
            "id": "customer",
            "value": {
              "operator": "contains",
              "value": "acme",
            },
          },
          {
            "id": "status",
            "value": {
              "operator": "in",
              "value": [
                "open",
                "paid",
              ],
            },
          },
          {
            "id": "value",
            "value": {
              "operator": "between",
              "value": [
                100,
                500,
              ],
            },
          },
          {
            "id": "notes",
            "value": {
              "operator": "isNull",
            },
          },
        ]
      `)
    })

    it("clears a filter, including a lower layer's", () => {
      expect(
        compile(
          [
            {
              op: "setFilter",
              target: table,
              filter: { field: "status", operator: "eq", value: "open" },
            },
            { op: "clearFilter", target: table, field: "status" },
            { op: "clearFilter", target: table, field: "region" },
          ],
          {},
          [
            {
              op: "setFilter",
              target: table,
              filter: { field: "region", operator: "eq", value: "EU" },
            },
            {
              op: "setFilter",
              target: table,
              filter: { field: "value", operator: "gte", value: 50 },
            },
          ]
        ).columnFilters
      ).toMatchInlineSnapshot(`
        [
          {
            "id": "value",
            "value": {
              "operator": "gte",
              "value": 50,
            },
          },
        ]
      `)
    })
  })

  it("ignores ops on other tables and unknown columns", () => {
    expect(
      compile([
        { op: "hide", target: "other-table/columns/notes" },
        { op: "hide", target: column("margin") },
        { op: "setColumnWidth", target: column("margin"), width: 200 },
        { op: "setSort", target: "other-table", sort: [] },
      ])
    ).toEqual(compile([{ op: "rename", target: table, label: "Orders" }]))
  })

  describe("reuse", () => {
    const ops = [
      {
        op: "setSort",
        target: table,
        sort: [{ field: "value", dir: "desc" }],
      },
      { op: "hide", target: column("notes") },
      { op: "move", target: column("value"), to: { before: "id" } },
      { op: "pin", target: column("id"), where: "start" },
      { op: "setColumnWidth", target: column("notes"), width: 320 },
      {
        op: "setFilter",
        target: table,
        filter: { field: "status", operator: "eq", value: "open" },
      },
    ]

    it("returns the previous state when nothing changed", () => {
      const previous = compile(ops)
      expect(compile(ops, { previous })).toBe(previous)
    })

    it("reuses every slice that didn't change", () => {
      const previous = compile(ops)
      const next = compile(
        [...ops, { op: "setColumnWidth", target: column("id"), width: 90 }],
        { previous }
      )
      expect(next).not.toBe(previous)
      expect(next.columnSizing).not.toBe(previous.columnSizing)
      expect(next.columnSizing).toEqual({ notes: 320, id: 90 })
      expect(next.sorting).toBe(previous.sorting)
      expect(next.columnVisibility).toBe(previous.columnVisibility)
      expect(next.columnOrder).toBe(previous.columnOrder)
      expect(next.columnPinning).toBe(previous.columnPinning)
      expect(next.columnFilters).toBe(previous.columnFilters)
    })

    it("compares slices by value, not by the ops behind them", () => {
      const previous = compile(ops)
      const next = compile(
        [
          ...ops,
          { op: "show", target: column("notes") },
          { op: "hide", target: column("notes") },
          {
            op: "setSort",
            target: table,
            sort: [{ field: "value", dir: "desc" }],
          },
        ],
        { previous }
      )
      expect(next).toBe(previous)
    })

    it("reuses empty slices", () => {
      const previous = compile([
        { op: "rename", target: table, label: "Orders" },
      ])
      const next = compile([{ op: "hide", target: column("notes") }], {
        previous,
      })
      expect(next.columnVisibility).not.toBe(previous.columnVisibility)
      expect(next.sorting).toBe(previous.sorting)
      expect(next.columnFilters).toBe(previous.columnFilters)
    })
  })

  describe("in linear steps", () => {
    const many = (size: number) => {
      const ids = Array.from(
        { length: size },
        (_, index) => `c${String(index)}`
      )
      const ops = ids.flatMap((id, index) => [
        { op: "hide", target: column(id) },
        { op: "setColumnWidth", target: column(id), width: 100 },
        {
          op: "setFilter",
          target: table,
          filter: { field: id, operator: "eq", value: index },
        },
        index % 2 === 0
          ? { op: "pin", target: column(id), where: "end" }
          : {
              op: "move",
              target: column(id),
              to: { after: ids[index + 1] ?? "c0" },
            },
      ])
      const overlays = Array.from(
        { length: Math.ceil(ops.length / 500) },
        (_, index) =>
          overlay(
            "personal",
            ops.slice(index * 500, index * 500 + 500),
            `01JBQ3V8Z7XKQ2M4N5P6R7${String(index).padStart(4, "0")}`
          )
      )
      return {
        ids,
        resolved: resolveLayers(overlays, { surface: "/orders" }),
      }
    }

    // Counts map reads, as resolveLayers' scaling tests do: 4n columns read
    // about 4 times as much when compiling is linear, 16 times when quadratic.
    const reads = (ids: string[], resolved: ResolvedLayers) => {
      const spy = vi.spyOn(Map.prototype, "get")
      try {
        compileTableState(resolved, { table, columns: ids })
        return spy.mock.calls.length
      } finally {
        spy.mockRestore()
      }
    }

    it("compiles many columns", () => {
      const small = many(500)
      const large = many(2000)
      expect(
        reads(large.ids, large.resolved) / reads(small.ids, small.resolved)
      ).toBeLessThan(6)
      const state = compileTableState(large.resolved, {
        table,
        columns: large.ids,
      })
      expect(state.columnOrder).toHaveLength(2000)
      expect(state.columnPinning.end).toHaveLength(1000)
      expect(state.columnFilters).toHaveLength(2000)
    })
  })
})
