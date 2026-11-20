import { describe, expect, it } from "vitest"

import { createExpressionChecker } from "@pliantui/core"

import { defineDataset } from "./define-dataset"
import { describeDataset } from "./describe-dataset"

const orders = defineDataset({
  id: "orders",
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

const client = { audience: "client" } as const

describe("describeDataset", () => {
  it("gives the client and the model the same descriptor", () => {
    expect(describeDataset(orders, { audience: "ai" })).toStrictEqual(
      describeDataset(orders, client)
    )
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
    expect(describeDataset(orders, client)).toStrictEqual({
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
    expect(Object.keys(describeDataset(orders, client).fields)).toEqual([
      "number",
      "value",
      "region",
      "placedAt",
    ])
  })

  it("is plain JSON", () => {
    const descriptor = describeDataset(orders, client)
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
    expect(
      describeDataset(withSecret, client).fields["value"]
    ).not.toHaveProperty("column")
  })

  it("returns copies the caller can change without changing the dataset", () => {
    const descriptor = describeDataset(orders, client)
    descriptor.rowKey.push("value")
    const values: unknown = Reflect.get(
      descriptor.fields["region"] ?? {},
      "values"
    )
    expect(Reflect.set(Object(values), 0, "west")).toBe(true)
    expect(describeDataset(orders, client).rowKey).toEqual(["number"])
    expect(describeDataset(orders, client).fields["region"]).toMatchObject({
      values: ["north", "south"],
    })
  })

  it("feeds core's expression checker", () => {
    const check = createExpressionChecker({
      fields: describeDataset(orders, client).fields,
    })
    expect(check({ field: "value" }, "row")).toEqual({
      success: true,
      data: { type: "number", unit: "INR" },
    })
  })
})
