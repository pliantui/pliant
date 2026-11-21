import { describe, expect, it } from "vitest"

import { createExpressionChecker } from "@pliantui/core"

import { allRows } from "./authorize-dataset"
import { defineDataset } from "./define-dataset"
import { describeDataset } from "./describe-dataset"

const orders = defineDataset({
  id: "orders",
  scope: "public",
  describe: "Customer orders",
  timeZone: "Asia/Tokyo",
  fields: {
    number: { type: "string", label: "Order" },
    value: {
      type: "currency",
      currency: "INR",
      describe: "Order value incl. tax",
      format: { type: "currency", decimals: 0 },
    },
    region: { type: "enum", values: ["north", "south"], groupable: false },
    placedAt: { type: "datetime" },
  },
  rowKey: "number",
})

const client = { audience: "client", user: null } as const

function describeForClient(
  dataset: Parameters<typeof describeDataset<null>>[0]
) {
  const descriptor = describeDataset(dataset, client)
  if (descriptor === null) {
    throw new Error("The dataset denied the user")
  }
  return descriptor
}

describe("describeDataset", () => {
  it("gives the client and the model the same descriptor when the model may see every field", () => {
    expect(
      describeDataset(orders, { audience: "ai", user: null })
    ).toStrictEqual(describeForClient(orders))
  })

  it("needs a known audience", () => {
    expect(() =>
      // @ts-expect-error the audience is required
      describeDataset(orders)
    ).toThrow('audience must be "client" or "ai", not undefined')
    expect(() =>
      // @ts-expect-error an unknown audience
      describeDataset(orders, { audience: "server" })
    ).toThrow('audience must be "client" or "ai", not "server"')
  })

  it("describes the fields' types, units, formats and capabilities", () => {
    expect(describeForClient(orders)).toStrictEqual({
      id: "orders",
      describe: "Customer orders",
      timeZone: "Asia/Tokyo",
      rowKey: ["number"],
      fields: {
        number: {
          type: "string",
          label: "Order",
          sortable: true,
          filterable: true,
          groupable: true,
          aggregatable: true,
        },
        value: {
          type: "currency",
          currency: "INR",
          describe: "Order value incl. tax",
          format: { type: "currency", decimals: 0 },
          sortable: true,
          filterable: true,
          groupable: false,
          aggregatable: true,
        },
        region: {
          type: "enum",
          values: ["north", "south"],
          sortable: true,
          filterable: true,
          groupable: false,
          aggregatable: true,
        },
        placedAt: {
          type: "datetime",
          sortable: true,
          filterable: true,
          groupable: false,
          aggregatable: true,
        },
      },
    })
  })

  it("keeps the dataset's field order", () => {
    expect(Object.keys(describeForClient(orders).fields)).toEqual([
      "number",
      "value",
      "region",
      "placedAt",
    ])
  })

  it("is plain JSON", () => {
    const descriptor = describeForClient(orders)
    expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor)
  })

  it("leaves out anything that isn't public", () => {
    const withSecret = {
      ...orders,
      fields: {
        ...orders.fields,
        value: { ...orders.fields.value, column: "orders.value_paise" },
      },
    }
    expect(describeForClient(withSecret).fields["value"]).not.toHaveProperty(
      "column"
    )
  })

  it("returns copies the caller can change without changing the dataset", () => {
    const descriptor = describeForClient(orders)
    descriptor.rowKey.push("value")
    const values: unknown = Reflect.get(
      descriptor.fields["region"] ?? {},
      "values"
    )
    expect(Reflect.set(Object(values), 0, "west")).toBe(true)
    expect(describeForClient(orders).rowKey).toEqual(["number"])
    expect(describeForClient(orders).fields["region"]).toMatchObject({
      values: ["north", "south"],
    })
  })

  it("feeds core's expression checker", () => {
    const check = createExpressionChecker({
      fields: describeForClient(orders).fields,
    })
    expect(check({ field: "value" }, "row")).toEqual({
      success: true,
      data: { type: "number", unit: "INR" },
    })
  })

  describe("for one user", () => {
    interface User {
      orgId: string
      roles: string[]
    }

    const accounts = defineDataset({
      id: "accounts",
      scope: (user: User) => ({ orgId: user.orgId }),
      access: (user) => user.roles.length > 0,
      fields: {
        id: { type: "id" },
        name: { type: "string" },
        margin: {
          type: "percent",
          describe: "Gross margin",
          access: (user) => user.roles.includes("finance"),
        },
        notes: { type: "text", exposeToAI: false },
      },
    })

    const sales: User = { orgId: "acme", roles: ["sales"] }
    const finance: User = { orgId: "acme", roles: ["finance"] }

    function fieldsFor(user: User, audience: "client" | "ai") {
      return Object.keys(
        describeDataset(accounts, { audience, user })?.fields ?? {}
      )
    }

    it("names only the fields the user may read, for both audiences", () => {
      expect(fieldsFor(sales, "client")).toEqual(["id", "name", "notes"])
      expect(fieldsFor(finance, "client")).toEqual([
        "id",
        "name",
        "margin",
        "notes",
      ])
      expect(
        JSON.stringify(
          describeDataset(accounts, { audience: "ai", user: sales })
        )
      ).not.toMatch(/margin/i)
    })

    it("keeps fields with exposeToAI: false from the model only", () => {
      expect(fieldsFor(finance, "ai")).toEqual(["id", "name", "margin"])
      expect(fieldsFor(sales, "ai")).toEqual(["id", "name"])
    })

    it("describes a user whose scope returns allRows as a public dataset does", () => {
      const fields = {
        id: { type: "id" },
        margin: {
          type: "percent",
          access: (user: User) => user.roles.includes("finance"),
        },
        notes: { type: "text", exposeToAI: false },
      } as const
      const admins = defineDataset({
        id: "accounts",
        scope: (user: User) =>
          user.roles.includes("admin") ? allRows : { orgId: user.orgId },
        fields,
      })
      const everyone = defineDataset<User, typeof fields>({
        id: "accounts",
        scope: "public",
        fields,
      })
      const admin: User = { orgId: "acme", roles: ["admin"] }
      for (const audience of ["client", "ai"] as const) {
        const descriptor = describeDataset(admins, { audience, user: admin })
        expect(descriptor).not.toBeNull()
        expect(descriptor).toEqual(
          describeDataset(everyone, { audience, user: admin })
        )
      }
    })

    it("returns null for a user the dataset's access doesn't allow", () => {
      const nobody: User = { orgId: "acme", roles: [] }
      expect(
        describeDataset(accounts, { audience: "client", user: nobody })
      ).toBeNull()
      expect(
        describeDataset(accounts, { audience: "ai", user: nobody })
      ).toBeNull()
    })

    it("throws instead of describing for a user whose scope is broken", () => {
      const orgless = { roles: ["sales"] } as unknown as User
      expect(() =>
        describeDataset(accounts, { audience: "ai", user: orgless })
      ).toThrow(TypeError)
    })

    it("never carries access functions or the scope", () => {
      const descriptor = describeDataset(accounts, {
        audience: "client",
        user: finance,
      })
      expect(JSON.parse(JSON.stringify(descriptor))).toStrictEqual(descriptor)
      expect(descriptor).not.toHaveProperty("scope")
      expect(descriptor?.fields["margin"]).not.toHaveProperty("access")
    })

    it("needs the user", () => {
      expect(() =>
        // @ts-expect-error the user is required
        describeDataset(accounts, { audience: "client" })
      ).toThrow()
    })
  })
})
