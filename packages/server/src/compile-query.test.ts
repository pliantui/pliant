import { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import type { Filter } from "@pliantui/contract"

import { allRows, authorizeDataset } from "./authorize-dataset"
import { compileQuery, type CompileQueryOptions } from "./compile-query"
import { defineDataset } from "./define-dataset"
import type { ServerQuery } from "./server-query"

interface User {
  readonly orgId: string | readonly string[]
  readonly admin?: boolean
}

const orders = defineDataset({
  id: "orders",
  timeZone: "America/New_York",
  scope: (user: User) => (user.admin ? allRows : { orgId: user.orgId }),
  fields: {
    id: { type: "integer" },
    customer: { type: "string" },
    status: { type: "enum", values: ["open", "closed", "Pending"] },
    total: { type: "currency", currency: "USD" },
    paid: { type: "boolean" },
    placed: { type: "date" },
    createdAt: { type: "datetime" },
    notes: { type: "text" },
    secret: { type: "number", access: (user: User) => user.admin === true },
    rank: { type: "integer", sortable: false, filterable: false },
  },
})

const options: CompileQueryOptions = {
  table: "orders",
  columns: {
    total: "total_amount",
    placed: "placed_on",
    createdAt: "created_at",
    orgId: "org_id",
  },
}

const ana: User = { orgId: "a" }
const admin: User = { orgId: "a", admin: true }

const client = new PGlite()

beforeAll(async () => {
  await client.exec(`
    CREATE TYPE status AS ENUM ('open', 'closed', 'Pending');
    CREATE TABLE orders (
      id integer PRIMARY KEY,
      org_id text NOT NULL,
      customer text COLLATE "und-x-icu",
      status status,
      total_amount numeric,
      paid boolean,
      placed_on date,
      created_at timestamptz,
      notes text,
      secret double precision,
      rank integer
    );
    INSERT INTO orders VALUES
      (1, 'a', 'Ana', 'open', 100, true, '2026-03-07', '2026-03-08T04:59:59Z', 'Rush 50% off', 1, 1),
      (2, 'a', 'bob', 'closed', 250, false, '2026-03-08', '2026-03-08T05:00:00Z', 'call_back', 2, 2),
      (9, 'a', 'Émile', 'Pending', 250, null, '2026-03-09', '2026-03-09T03:59:59Z', null, 3, 3),
      (10, 'a', 'ana', 'open', 250, true, null, '2026-03-09T04:00:00Z', 'rush', 4, 4),
      (3, 'a', null, 'closed', null, false, '2026-03-08', null, 'RUSH order', 5, 5),
      (4, 'a', 'Zoe', 'open', 75.5, true, '2026-03-10', '2026-03-10T12:00:00Z', '50 percent', 6, 6),
      (5, 'b', 'Ana', 'open', 250, true, '2026-03-08', '2026-03-08T12:00:00Z', 'rush', 7, 7),
      (6, 'b', 'Mallory', 'closed', 1, false, '2026-03-08', '2026-03-08T12:00:00Z', 'rush', 8, 8);
    CREATE TABLE "line ""items""" (sku text COLLATE "und-x-icu" PRIMARY KEY, "na""me" text);
    INSERT INTO "line ""items""" VALUES
      ('b', 'x'), ('B', 'x'), ('a', 'x'), ('10', 'x'), ('9', 'x'),
      (E'\\uFFFF', 'x'), (E'\\U0001F600', 'x');
    CREATE TABLE numbers AS SELECT n AS id FROM generate_series(1, 150) AS n;
  `)
}, 60_000)

afterAll(() => client.close())

async function run(
  query: Omit<ServerQuery, "dataset" | "page"> & {
    page?: ServerQuery["page"]
  },
  user: User = ana,
  overrides: Partial<CompileQueryOptions> = {}
) {
  const grant = authorizeDataset(orders, user)
  if (grant === null) {
    throw new Error("no grant")
  }
  const { text, values } = compileQuery(
    orders,
    grant,
    { dataset: "orders", page: { index: 0, size: 50 }, ...query },
    { ...options, ...overrides }
  )
  const { rows } = await client.query<Record<string, unknown>>(text, values)
  return rows
}

async function ids(
  query: Parameters<typeof run>[0],
  user?: User,
  overrides?: Partial<CompileQueryOptions>
) {
  return (await run(query, user, overrides)).map((row) => row["id"])
}

const where = (...filters: Filter[]) => ids({ filters })

describe("compileQuery", () => {
  describe("fields and scope", () => {
    it("selects only the fields the user may read, under their ids", async () => {
      const [row] = await run({
        filters: [{ field: "id", operator: "eq", value: 1 }],
      })
      expect(Object.keys(row ?? {})).toEqual([
        "id",
        "customer",
        "status",
        "total",
        "paid",
        "placed",
        "createdAt",
        "notes",
        "rank",
      ])
      const [adminRow] = await run(
        { filters: [{ field: "id", operator: "eq", value: 1 }] },
        admin
      )
      expect(adminRow).toHaveProperty("secret", 1)
    })

    it("loads only the rows in the user's scope", async () => {
      expect(await ids({})).toEqual([1, 2, 3, 4, 9, 10])
      expect(await ids({}, { orgId: "b" })).toEqual([5, 6])
      expect(
        await ids({
          filters: [{ field: "customer", operator: "eq", value: "Ana" }],
        })
      ).toEqual([1])
    })

    it("matches a scope list with any of its values", async () => {
      expect(await ids({}, { orgId: ["a", "b"] })).toEqual([
        1, 2, 3, 4, 5, 6, 9, 10,
      ])
      expect(await ids({}, { orgId: ["c"] })).toEqual([])
    })

    it("loads every row for a grant of all rows", async () => {
      expect(await ids({}, admin)).toEqual([1, 2, 3, 4, 5, 6, 9, 10])
    })
  })

  describe("sort", () => {
    it("puts rows without a value last in either direction, ties by numeric row key", async () => {
      expect(await ids({ sort: [{ field: "total", desc: false }] })).toEqual([
        4, 1, 2, 9, 10, 3,
      ])
      expect(await ids({ sort: [{ field: "total", desc: true }] })).toEqual([
        2, 9, 10, 1, 4, 3,
      ])
    })

    it("puts rows without a value first when asked", async () => {
      expect(
        await ids({ sort: [{ field: "total", desc: false, nulls: "first" }] })
      ).toEqual([3, 4, 1, 2, 9, 10])
    })

    it("sorts by each field in turn", async () => {
      expect(
        await ids({
          sort: [
            { field: "paid", desc: true },
            { field: "total", desc: false },
          ],
        })
      ).toEqual([4, 1, 10, 2, 3, 9])
    })

    it("sorts text in the column's collation", async () => {
      expect(await ids({ sort: [{ field: "customer", desc: false }] })).toEqual(
        [10, 1, 2, 9, 4, 3]
      )
    })

    it("sorts an enum by its text, not its declared order", async () => {
      expect(await ids({ sort: [{ field: "status", desc: false }] })).toEqual([
        9, 2, 3, 1, 4, 10,
      ])
    })

    it("orders text row keys by code point", async () => {
      const items = defineDataset({
        id: "items",
        rowKey: "sku",
        scope: "public",
        fields: { sku: { type: "string" }, name: { type: "string" } },
      })
      const grant = authorizeDataset(items, undefined as never)
      if (grant === null) {
        throw new Error("no grant")
      }
      const { text, values } = compileQuery(
        items,
        grant,
        {
          dataset: "items",
          sort: [{ field: "name", desc: false }],
          page: { index: 0, size: 10 },
        },
        { table: 'line "items"', columns: { name: 'na"me' } }
      )
      const { rows } = await client.query<{ sku: string }>(text, values)
      expect(rows.map((row) => row.sku)).toEqual([
        "10",
        "9",
        "B",
        "a",
        "b",
        "￿",
        "\u{1F600}",
      ])
    })
  })

  describe("filters", () => {
    it("compares numbers", async () => {
      const total = (operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte") =>
        where({ field: "total", operator, value: 100 })
      expect(
        await where({ field: "total", operator: "eq", value: 250 })
      ).toEqual([2, 9, 10])
      expect(await total("neq")).toEqual([2, 4, 9, 10])
      expect(await total("gt")).toEqual([2, 9, 10])
      expect(await total("gte")).toEqual([1, 2, 9, 10])
      expect(await total("lt")).toEqual([4])
      expect(await total("lte")).toEqual([1, 4])
      expect(
        await where({ field: "total", operator: "between", value: [75.5, 100] })
      ).toEqual([1, 4])
      expect(
        await where({ field: "total", operator: "in", value: [100, 75.5] })
      ).toEqual([1, 4])
      expect(await where({ field: "total", operator: "isNull" })).toEqual([3])
      expect(
        await where({ field: "id", operator: "in", value: [10, 1] })
      ).toEqual([1, 10])
    })

    it("compares text case-sensitively, and orders it by code point", async () => {
      expect(
        await where({ field: "customer", operator: "eq", value: "ana" })
      ).toEqual([10])
      expect(
        await where({ field: "customer", operator: "neq", value: "ana" })
      ).toEqual([1, 2, 4, 9])
      expect(
        await where({
          field: "customer",
          operator: "in",
          value: ["Ana", "bob"],
        })
      ).toEqual([1, 2])
      expect(
        await where({ field: "customer", operator: "gt", value: "Zoe" })
      ).toEqual([2, 9, 10])
      expect(
        await where({ field: "customer", operator: "lt", value: "a" })
      ).toEqual([1, 4])
      expect(
        await where({ field: "status", operator: "gt", value: "closed" })
      ).toEqual([1, 4, 10])
      expect(
        await where({ field: "status", operator: "eq", value: "Pending" })
      ).toEqual([9])
    })

    it("matches contains and startsWith case-insensitively", async () => {
      expect(
        await where({ field: "customer", operator: "contains", value: "AN" })
      ).toEqual([1, 10])
      expect(
        await where({ field: "customer", operator: "startsWith", value: "é" })
      ).toEqual([9])
      expect(
        await where({ field: "notes", operator: "contains", value: "rush" })
      ).toEqual([1, 3, 10])
      expect(
        await where({ field: "notes", operator: "startsWith", value: "Rush" })
      ).toEqual([1, 3, 10])
    })

    it("matches %, _ and \\ in a search literally", async () => {
      expect(
        await where({ field: "notes", operator: "contains", value: "50%" })
      ).toEqual([1])
      expect(
        await where({ field: "notes", operator: "contains", value: "l_b" })
      ).toEqual([2])
      expect(
        await where({ field: "notes", operator: "contains", value: "_" })
      ).toEqual([2])
      expect(
        await where({ field: "notes", operator: "startsWith", value: "%" })
      ).toEqual([])
      expect(
        await where({ field: "notes", operator: "contains", value: "\\" })
      ).toEqual([])
    })

    it("compares booleans, leaving out rows without a value", async () => {
      expect(
        await where({ field: "paid", operator: "eq", value: true })
      ).toEqual([1, 4, 10])
      expect(
        await where({ field: "paid", operator: "neq", value: true })
      ).toEqual([2, 3])
      expect(
        await where({ field: "paid", operator: "in", value: [false] })
      ).toEqual([2, 3])
      expect(await where({ field: "paid", operator: "isNull" })).toEqual([9])
    })

    it("reads a day as that day in the dataset's time zone, across a clock change", async () => {
      const day = "2026-03-08"
      const createdAt = (
        operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
      ) => where({ field: "createdAt", operator, value: day })
      expect(await createdAt("eq")).toEqual([2, 9])
      expect(await createdAt("neq")).toEqual([1, 4, 10])
      expect(await createdAt("gt")).toEqual([4, 10])
      expect(await createdAt("gte")).toEqual([2, 4, 9, 10])
      expect(await createdAt("lt")).toEqual([1])
      expect(await createdAt("lte")).toEqual([1, 2, 9])
      expect(
        await where({
          field: "createdAt",
          operator: "between",
          value: [day, day],
        })
      ).toEqual([2, 9])
      expect(
        await where({
          field: "createdAt",
          operator: "in",
          value: ["2026-03-07", "2026-03-10"],
        })
      ).toEqual([1, 4])
    })

    it("reads an instant with an offset as given, and one without in the dataset's time zone", async () => {
      expect(
        await where({
          field: "createdAt",
          operator: "eq",
          value: "2026-03-08T05:00:00Z",
        })
      ).toEqual([2])
      expect(
        await where({
          field: "createdAt",
          operator: "eq",
          value: "2026-03-08T00:00:00",
        })
      ).toEqual([2])
      expect(
        await where({
          field: "createdAt",
          operator: "gte",
          value: "2026-03-08T23:59:59",
        })
      ).toEqual([4, 9, 10])
    })

    it("compares a date with the day an instant falls on in the dataset's time zone", async () => {
      expect(
        await where({ field: "placed", operator: "eq", value: "2026-03-08" })
      ).toEqual([2, 3])
      expect(
        await where({
          field: "placed",
          operator: "eq",
          value: "2026-03-09T03:00:00Z",
        })
      ).toEqual([2, 3])
      expect(
        await where({
          field: "placed",
          operator: "gt",
          value: "2026-03-09T03:00:00Z",
        })
      ).toEqual([4, 9])
      expect(
        await where({ field: "placed", operator: "lt", value: "2026-03-08" })
      ).toEqual([1])
      expect(
        await where({
          field: "placed",
          operator: "between",
          value: ["2026-03-08", "2026-03-09"],
        })
      ).toEqual([2, 3, 9])
      expect(await where({ field: "placed", operator: "isNull" })).toEqual([10])
    })

    it("applies every filter", async () => {
      expect(
        await where(
          { field: "status", operator: "eq", value: "open" },
          { field: "total", operator: "gte", value: 100 }
        )
      ).toEqual([1, 10])
    })
  })

  describe("paging", () => {
    it("returns the asked-for page", async () => {
      expect(await ids({ page: { index: 1, size: 2 } })).toEqual([3, 4])
      expect(await ids({ page: { index: 3, size: 2 } })).toEqual([])
    })

    it("caps the page size at maxPageSize", async () => {
      expect(
        await ids({ page: { index: 0, size: 10 } }, ana, { maxPageSize: 4 })
      ).toEqual([1, 2, 3, 4])
      expect(
        await ids({ page: { index: 1, size: 10 } }, ana, { maxPageSize: 4 })
      ).toEqual([9, 10])
    })

    it("caps the page size at 100 by default", async () => {
      const numbers = defineDataset({
        id: "numbers",
        scope: "public",
        fields: { id: { type: "integer" } },
      })
      const grant = authorizeDataset(numbers, undefined as never)
      if (grant === null) {
        throw new Error("no grant")
      }
      const page = async (index: number) => {
        const { text, values } = compileQuery(
          numbers,
          grant,
          { dataset: "numbers", page: { index, size: 1000 } },
          { table: "numbers" }
        )
        return (await client.query<{ id: number }>(text, values)).rows
      }
      const first = await page(0)
      expect(first).toHaveLength(100)
      expect(first.at(-1)?.id).toBe(100)
      expect((await page(1)).map((row) => row.id)).toEqual(
        Array.from({ length: 50 }, (_, index) => index + 101)
      )
    })
  })

  describe("rejection", () => {
    const compile = (query: unknown, user: User = ana) => {
      const grant = authorizeDataset(orders, user)
      if (grant === null) {
        throw new Error("no grant")
      }
      return () =>
        compileQuery(
          orders,
          grant,
          {
            dataset: "orders",
            page: { index: 0, size: 10 },
            ...Object(query),
          } as ServerQuery,
          options
        )
    }

    it("passes values as parameters, so they can't change the query", async () => {
      const value = "x' OR '1'='1'; DROP TABLE orders; --"
      expect(await where({ field: "customer", operator: "eq", value })).toEqual(
        []
      )
      expect(
        await where({ field: "notes", operator: "contains", value })
      ).toEqual([])
      expect(await ids({})).toEqual([1, 2, 3, 4, 9, 10])
    })

    it("rejects field names that aren't ids", () => {
      for (const field of ['id" --', "id; DROP TABLE orders", "lower(id)"]) {
        expect(compile({ filters: [{ field, operator: "isNull" }] })).toThrow(
          TypeError
        )
        expect(compile({ sort: [{ field, desc: false }] })).toThrow(TypeError)
      }
    })

    it("rejects fields the user can't read as if they didn't exist", () => {
      for (const field of ["secret", "orgId", "constructor"]) {
        const message = `Query on dataset "orders": no field "${field}"`
        expect(compile({ sort: [{ field, desc: false }] })).toThrow(message)
        expect(
          compile({ filters: [{ field, operator: "eq", value: 1 }] })
        ).toThrow(message)
      }
      expect(
        compile({ sort: [{ field: "secret", desc: false }] }, admin)
      ).not.toThrow()
    })

    it("rejects sorts and filters the field's capabilities don't allow", () => {
      expect(compile({ sort: [{ field: "rank", desc: false }] })).toThrow(
        `"rank" can't be sorted`
      )
      expect(compile({ sort: [{ field: "notes", desc: false }] })).toThrow(
        `"notes" can't be sorted`
      )
      expect(
        compile({ filters: [{ field: "rank", operator: "isNull" }] })
      ).toThrow(`"rank" can't be filtered`)
      expect(
        compile({ filters: [{ field: "notes", operator: "eq", value: "x" }] })
      ).toThrow(`"notes" can't be filtered with eq`)
    })

    it("rejects operators and values that don't fit the field", () => {
      for (const filter of [
        { field: "paid", operator: "gt", value: true },
        { field: "total", operator: "contains", value: "1" },
        { field: "total", operator: "contains", value: 1 },
        { field: "paid", operator: "eq", value: "true" },
        { field: "total", operator: "eq", value: "100" },
        { field: "id", operator: "gt", value: 2.5 },
        { field: "customer", operator: "eq", value: 1 },
        { field: "placed", operator: "eq", value: "2026-02-30" },
        { field: "createdAt", operator: "eq", value: "yesterday" },
        { field: "createdAt", operator: "eq", value: 1_772_946_000_000 },
        { field: "customer", operator: "custom", value: "x" },
      ]) {
        expect(compile({ filters: [filter] })).toThrow(TypeError)
      }
    })

    it("rejects a query that isn't valid or names another dataset", () => {
      expect(compile({ dataset: "users" })).toThrow(
        `the query is for dataset "users"`
      )
      expect(compile({ page: { index: -1, size: 10 } })).toThrow(TypeError)
      expect(compile({ page: { index: 0, size: 0 } })).toThrow(TypeError)
      expect(compile({ limit: 1000 })).toThrow(TypeError)
      expect(
        compile({
          sort: [
            { field: "id", desc: false },
            { field: "id", desc: true },
          ],
        })
      ).toThrow(TypeError)
    })

    it("rejects a grant that doesn't fit the dataset", () => {
      const query: ServerQuery = {
        dataset: "orders",
        page: { index: 0, size: 10 },
      }
      for (const grant of [
        { scope: {}, fields: ["id"], minGroupSize: 1 },
        { scope: { orgId: [] }, fields: ["id"], minGroupSize: 1 },
        { scope: "all" as const, fields: ["customer"], minGroupSize: 1 },
        { scope: "all" as const, fields: ["id", "cost"], minGroupSize: 1 },
      ]) {
        expect(() => compileQuery(orders, grant, query, options)).toThrow(
          TypeError
        )
      }
    })
  })
})
