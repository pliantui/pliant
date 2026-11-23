import { describe, expect, it } from "vitest"

import type { Expression, Op } from "@pliantui/contract"
import { checkExpression } from "@pliantui/core"

import { sectionsDataset } from "@/lib/acme/data"
import { ordersDataset } from "@/lib/demo/schema"

import { scriptedAnswers } from "./scripted-answers"

const tables = [
  { target: "orders-table", fields: ordersDataset.fields },
  { target: "acme-sections", fields: sectionsDataset.fields },
]

function expressionsOf(
  op: Op
): { expr: Expression; kind: "row" | "aggregate" }[] {
  if (op.op === "addDerived") return [{ expr: op.expr, kind: "row" }]
  if (op.op === "addAggregate") return [{ expr: op.expr, kind: "aggregate" }]
  if (op.op === "addHighlight") return [{ expr: op.when, kind: "row" }]
  return []
}

describe("scripted answers for data tables", () => {
  it.each(tables)(
    "use expressions that check against $target's fields",
    ({ target, fields }) => {
      const expressions = scriptedAnswers
        .filter((answer) => answer.target === target)
        .flatMap((answer) => answer.ops.flatMap(expressionsOf))
      expect(expressions.length).toBeGreaterThan(0)
      for (const { expr, kind } of expressions) {
        const result = checkExpression(expr, { fields, kind })
        expect(result.success, JSON.stringify(expr)).toBe(true)
      }
    }
  )
})
