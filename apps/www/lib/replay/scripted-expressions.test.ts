import { describe, expect, it } from "vitest"

import { checkExpression } from "@pliantui/core"

import { ordersDataset } from "@/lib/demo/schema"

import { scriptedAnswers } from "./scripted-answers"

describe("scripted answers for the orders table", () => {
  it("use expressions that check against the orders' fields", () => {
    const ops = scriptedAnswers
      .filter((answer) => answer.target === "orders-table")
      .flatMap((answer) => answer.ops)
    const expressions = ops.flatMap((op) =>
      op.op === "addDerived" || op.op === "addAggregate"
        ? [
            {
              expr: op.expr,
              kind: op.op === "addDerived" ? "row" : "aggregate",
            },
          ]
        : op.op === "addHighlight"
          ? [{ expr: op.when, kind: "row" }]
          : []
    )
    expect(expressions.length).toBeGreaterThan(0)
    for (const { expr, kind } of expressions) {
      const result = checkExpression(expr, {
        fields: ordersDataset.fields,
        kind: kind === "row" ? "row" : "aggregate",
      })
      expect(result.success, JSON.stringify(expr)).toBe(true)
    }
  })
})
