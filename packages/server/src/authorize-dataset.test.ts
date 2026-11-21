import { describe, expect, expectTypeOf, it } from "vitest"

import { allRows, authorizeDataset } from "./authorize-dataset"
import { defineDataset, type InferRow } from "./define-dataset"

interface User {
  id: string
  orgId?: unknown
  teamIds?: unknown
  roles: string[]
}

const alice: User = { id: "alice", orgId: "acme", roles: ["sales"] }

const orders = defineDataset({
  id: "orders",
  scope: (user: User) => ({ orgId: user.orgId as string }),
  fields: {
    id: { type: "id" },
    value: { type: "currency", currency: "USD" },
    cost: {
      type: "currency",
      currency: "USD",
      access: (user) => user.roles.includes("finance"),
    },
    notes: { type: "text", exposeToAI: false },
  },
})

const scopeError = new TypeError(
  'Dataset "orders": scope(user) must return allRows or conditions by id, each a string, finite number, boolean or non-empty list of them'
)

function withScope(scope: (user: User) => unknown) {
  return defineDataset({
    id: "orders",
    // @ts-expect-error a scope that returns anything, as JavaScript can
    scope,
    fields: { id: { type: "id" } },
  })
}

describe("authorizeDataset", () => {
  it("returns the user's row scope, readable fields and minimum group size", () => {
    expect(authorizeDataset(orders, alice)).toStrictEqual({
      scope: { orgId: "acme" },
      fields: ["id", "value", "notes"],
      minGroupSize: 1,
    })
  })

  it("lists a field only for users its access allows", () => {
    const finance = { ...alice, roles: ["finance"] }
    expect(authorizeDataset(orders, finance)?.fields).toEqual([
      "id",
      "value",
      "cost",
      "notes",
    ])
  })

  it("allows only on true, so a truthy value or a promise doesn't", () => {
    for (const answer of [1, "yes", {}, Promise.resolve(true), undefined]) {
      const dataset = defineDataset({
        id: "orders",
        scope: "public",
        access: () => answer as boolean,
        fields: {
          id: { type: "id" },
          cost: { type: "number", access: () => answer as boolean },
        },
      })
      expect(authorizeDataset(dataset, alice)).toBeNull()
      const open = defineDataset({
        id: "orders",
        scope: "public",
        fields: {
          id: { type: "id" },
          cost: { type: "number", access: () => answer as boolean },
        },
      })
      expect(authorizeDataset(open, alice)?.fields).toEqual(["id"])
    }
  })

  it("returns null when the dataset's access doesn't allow the user", () => {
    const finance = defineDataset({
      id: "ledger",
      scope: (user: User) => ({ orgId: user.orgId as string }),
      access: (user) => user.roles.includes("finance"),
      fields: { id: { type: "id" } },
    })
    expect(authorizeDataset(finance, alice)).toBeNull()
    expect(authorizeDataset(finance, { ...alice, roles: ["finance"] })).toEqual(
      { scope: { orgId: "acme" }, fields: ["id"], minGroupSize: 1 }
    )
  })

  it('grants every row of a "public" dataset as "all"', () => {
    const regions = defineDataset({
      id: "regions",
      scope: "public",
      privacy: { minGroupSize: 5 },
      fields: { id: { type: "id" } },
    })
    expect(authorizeDataset(regions, null)).toEqual({
      scope: "all",
      fields: ["id"],
      minGroupSize: 5,
    })
  })

  describe("allRows", () => {
    const accounts = defineDataset({
      id: "orders",
      scope: (user: User) =>
        user.roles.includes("admin")
          ? allRows
          : { orgId: user.orgId as string },
      privacy: { minGroupSize: 3 },
      fields: {
        id: { type: "id" },
        cost: {
          type: "number",
          access: (user) => user.roles.includes("finance"),
        },
      },
    })
    const admin: User = { id: "root", roles: ["admin"] }

    it("grants every row to the user whose scope returns it", () => {
      const grant = authorizeDataset(accounts, admin)
      expect(grant).toStrictEqual({
        scope: "all",
        fields: ["id"],
        minGroupSize: 3,
      })
      expect(JSON.parse(JSON.stringify(grant))).toEqual(grant)
      expect(authorizeDataset(accounts, alice)?.scope).toEqual({
        orgId: "acme",
      })
    })

    it("keeps an object that looks like the grant a condition", () => {
      expect(
        authorizeDataset(
          withScope(() => ({ scope: "all" })),
          alice
        )?.scope
      ).toEqual({ scope: "all" })
    })

    it.each([
      ["undefined", undefined],
      ["null", null],
      ["no conditions", {}],
      ['the text "all"', "all"],
      ['the text "public"', "public"],
      ["the marker's name", "allRows"],
      ["the marker as text", String(allRows)],
      ["a symbol with the same name", Symbol("allRows")],
      ["a registered symbol with the same name", Symbol.for("allRows")],
      ["an object holding the marker", { allRows }],
      ["an object keyed by the marker", { [allRows]: true }],
      ["a list holding the marker", [allRows]],
      ["a condition set to the marker", { orgId: allRows }],
      ["a promise of the marker", Promise.resolve(allRows)],
      ["the marker parsed from JSON", JSON.parse(JSON.stringify({ allRows }))],
    ])("doesn't grant every row for %s", (_, scope) => {
      expect(() =>
        authorizeDataset(
          withScope(() => scope),
          alice
        )
      ).toThrow(scopeError)
    })
  })

  it("keeps lists of values and copies them", () => {
    const teamIds = ["north", 2, true]
    const dataset = withScope((user) => ({ teamId: user.teamIds }))
    const grant = authorizeDataset(dataset, { ...alice, teamIds })
    teamIds.push("south")
    expect(grant?.scope).toEqual({ teamId: ["north", 2, true] })
  })

  it("returns a frozen copy of plain JSON, so it can be part of a cache key", () => {
    const scope = { orgId: "acme", teamId: ["north"] }
    const grant = authorizeDataset(
      withScope(() => scope),
      alice
    )
    scope.orgId = "globex"
    expect(grant?.scope).toEqual({ orgId: "acme", teamId: ["north"] })
    expect(JSON.parse(JSON.stringify(grant))).toEqual(grant)
    expect(Object.isFrozen(grant)).toBe(true)
    expect(Object.isFrozen(grant?.scope)).toBe(true)
    expect(Object.isFrozen(grant?.fields)).toBe(true)
    expect(Reflect.get(Object(grant?.scope), "teamId")).toSatisfy(
      Object.isFrozen
    )
  })

  it("calls scope once per call, with the user", () => {
    const users: unknown[] = []
    const dataset = withScope((user) => {
      users.push(user)
      return { orgId: user.orgId }
    })
    authorizeDataset(dataset, alice)
    expect(users).toEqual([alice])
  })

  it.each([
    ["a missing value", { orgId: undefined }],
    ["null", { orgId: null }],
    ["NaN", { orgId: Number.NaN }],
    ["Infinity", { orgId: Number.POSITIVE_INFINITY }],
    ["an object", { orgId: { not: "acme" } }],
    ["an empty list", { orgId: [] }],
    ["a list with a missing value", { orgId: ["acme", undefined] }],
    ["no conditions", {}],
    ["undefined", undefined],
    ["a string", "acme"],
    ["a list", ["acme"]],
    ["a promise", Promise.resolve({ orgId: "acme" })],
  ])("throws, never widening the scope, for %s", (_, scope) => {
    expect(() =>
      authorizeDataset(
        withScope(() => scope),
        alice
      )
    ).toThrow(scopeError)
  })

  it("throws for a nested list", () => {
    expect(() =>
      authorizeDataset(
        withScope(() => ({ orgId: [["acme"]] })),
        alice
      )
    ).toThrow(scopeError)
  })

  describe("a scope that hides a condition from the copy", () => {
    class Scope {
      orgId = "acme"
      get region() {
        return this.orgId === "acme" ? "eu" : "us"
      }
    }
    const nonEnumerable = { orgId: "acme" }
    Object.defineProperty(nonEnumerable, "region", {
      value: "eu",
      enumerable: false,
    })

    it.each([
      ["a getter on a class's prototype", new Scope()],
      ["a symbol key", { orgId: "acme", [Symbol("region")]: "eu" }],
      ["a non-enumerable property", nonEnumerable],
    ])("throws for %s", (_, scope) => {
      expect(() =>
        authorizeDataset(
          withScope(() => scope),
          alice
        )
      ).toThrow(scopeError)
    })
  })

  it.each([
    ["__proto__", '{ "__proto__": 1 }'],
    ["an empty key", '{ "": 1 }'],
    ["a key with a quote and SQL", '{ "orgId\\" OR 1=1 --": 1 }'],
  ])("throws for %s as a condition's name", (_, json) => {
    expect(() =>
      authorizeDataset(
        withScope(() => JSON.parse(json) as unknown),
        alice
      )
    ).toThrow(scopeError)
  })

  it("accepts a scope without a prototype", () => {
    const scope = Object.assign(Object.create(null) as object, {
      orgId: "acme",
    })
    expect(
      authorizeDataset(
        withScope(() => scope),
        alice
      )?.scope
    ).toEqual({ orgId: "acme" })
  })

  it("checks access before it runs scope", () => {
    const dataset = defineDataset({
      id: "ledger",
      scope: () => {
        throw new Error("scope ran")
      },
      access: (user: User) => user.roles.includes("finance"),
      fields: { id: { type: "id" } },
    })
    expect(authorizeDataset(dataset, alice)).toBeNull()
  })

  it("throws for a user without the value the scope reads", () => {
    expect(() => authorizeDataset(orders, { id: "bob", roles: [] })).toThrow(
      TypeError
    )
  })

  it("passes on errors that scope and access throw", () => {
    const failure = new Error("session expired")
    const dataset = defineDataset({
      id: "orders",
      scope: () => {
        throw failure
      },
      fields: { id: { type: "id" } },
    })
    expect(() => authorizeDataset(dataset, alice)).toThrow(failure)
    const guarded = defineDataset({
      id: "orders",
      scope: "public",
      fields: {
        id: { type: "id" },
        cost: {
          type: "number",
          access: () => {
            throw failure
          },
        },
      },
    })
    expect(() => authorizeDataset(guarded, alice)).toThrow(failure)
  })

  it("types the user as the dataset's scope and access take it", () => {
    expectTypeOf<InferRow<typeof orders>>().toEqualTypeOf<{
      id: string
      value: number | null
      cost: number | null
      notes: string | null
    }>()
    expect(() =>
      // @ts-expect-error not the dataset's user
      authorizeDataset(orders, { name: "alice" })
    ).toThrow(TypeError)
    defineDataset({
      id: "orders",
      // @ts-expect-error a condition can't be undefined
      scope: (user: User) => ({ orgId: user.id === "" ? undefined : user.id }),
      fields: { id: { type: "id" } },
    })
    defineDataset({
      id: "orders",
      scope: (user: { orgIds: string[] }) => ({ orgId: user.orgIds }),
      fields: { id: { type: "id" } },
    })
    defineDataset({
      id: "orders",
      // @ts-expect-error only the allRows marker grants every row
      scope: () => Symbol("allRows"),
      fields: { id: { type: "id" } },
    })
    expect(() =>
      // @ts-expect-error every dataset declares its scope
      defineDataset({ id: "orders", fields: { id: { type: "id" } } })
    ).toThrow('scope must be "public" or a function')
  })
})
