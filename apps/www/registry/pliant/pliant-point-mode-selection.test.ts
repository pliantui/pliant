import { describe, expect, it } from "vitest"

import {
  handlesOf,
  moveOp,
  partsOf,
  spanOp,
  type PliantPointTarget,
} from "./pliant-point-mode-selection"

const region = (
  capabilities: NonNullable<
    PliantPointTarget["context"]
  >["manifest"]["capabilities"]
): PliantPointTarget => ({
  id: "key-metrics",
  label: "Key metrics",
  context: {
    manifest: { capabilities },
    collection: { name: "slots", items: [{ id: "revenue" }] },
  },
})

describe("partsOf", () => {
  it("lists the slots of targets with a slots collection only", () => {
    expect(
      partsOf([
        region({}),
        {
          id: "orders-table",
          label: "Orders",
          context: {
            manifest: { capabilities: {} },
            collection: { name: "columns", items: [{ id: "id" }] },
          },
        },
      ])
    ).toEqual([
      {
        id: "revenue",
        label: "revenue",
        address: "key-metrics/slots/revenue",
        parent: "key-metrics",
      },
    ])
  })
})

describe("handlesOf", () => {
  const all = region({ slots: true, layout: true, hideable: true })
  const [part] = partsOf([all])

  it("offers what the region's manifest allows", () => {
    expect(handlesOf(part, [all], {}, 4)).toEqual({
      move: true,
      span: true,
      hide: true,
    })
    expect(handlesOf(part, [region({ hideable: true })], {}, 4)).toEqual({
      move: false,
      span: false,
      hide: true,
    })
  })

  it("offers no resize in a single column", () => {
    expect(handlesOf(part, [all], {}, 1).span).toBe(false)
  })

  it("follows the part's flags", () => {
    const address = "key-metrics/slots/revenue"
    expect(
      handlesOf(part, [all], { [address]: { required: true } }, 4)
    ).toEqual({ move: true, span: true, hide: false })
    expect(handlesOf(part, [all], { [address]: { locked: true } }, 4)).toEqual({
      move: false,
      span: false,
      hide: false,
    })
  })

  it("offers nothing without a part", () => {
    expect(handlesOf(undefined, [all], {}, 4)).toEqual({
      move: false,
      span: false,
      hide: false,
    })
  })
})

describe("moveOp", () => {
  const order = ["a", "b", "c"]

  it("moves before the part it lands on going back, and after it going on", () => {
    expect(moveOp("r/slots/c", order, "c", 0)).toEqual({
      op: "move",
      target: "r/slots/c",
      to: { before: "a" },
    })
    expect(moveOp("r/slots/a", order, "a", 1)).toEqual({
      op: "move",
      target: "r/slots/a",
      to: { after: "b" },
    })
  })

  it("stays put at either end and on itself", () => {
    expect(moveOp("r/slots/a", order, "a", -1)).toBeUndefined()
    expect(moveOp("r/slots/c", order, "c", 3)).toBeUndefined()
    expect(moveOp("r/slots/b", order, "b", 1)).toBeUndefined()
  })
})

describe("spanOp", () => {
  it("spans from the breakpoint the page is at", () => {
    expect(spanOp("r/slots/a", 2, 1300)).toEqual({
      op: "span",
      target: "r/slots/a",
      columns: 2,
      at: "xl",
    })
    expect(spanOp("r/slots/a", 1, 390)).toEqual({
      op: "span",
      target: "r/slots/a",
      columns: 1,
    })
  })
})
