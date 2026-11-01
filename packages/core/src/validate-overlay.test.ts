import { describe, expect, it } from "vitest"

import { overlaySchema } from "@pliantui/contract"

import { validateOverlay } from "./validate-overlay"

function overlay(ops: unknown[]) {
  return {
    v: 1,
    id: "01JBQ3V8Z7XKQ2M4N5P6R7S8T9",
    surface: "/orders/[id]",
    layer: "personal",
    ops,
    basis: { contract: 1, core: "0.1.0", manifests: {} },
    source: "ai",
    createdBy: "user_123",
    createdAt: "2026-11-01T09:30:00.000Z",
  }
}

describe("validateOverlay", () => {
  it("returns the overlay with parsed ops when every op is valid", () => {
    const result = validateOverlay(
      overlay([
        { op: "hide", target: "orders-table/columns/notes" },
        { op: "setDensity", target: "@surface", density: "compact" },
      ])
    )
    expect(result.data?.ops.map(({ op }) => op)).toEqual(["hide", "setDensity"])
  })

  it("rejects the whole overlay when any op fails, with paths into ops", () => {
    const result = validateOverlay(
      overlay([
        { op: "hide", target: "orders-table/columns/notes" },
        { op: "setTheme", target: "orders-table" },
        { op: "hide", target: "orders-table/columns/notes", at: "sm" },
        { op: "rename", target: "orders-table/columns/notes", label: "" },
      ])
    )
    expect(
      result.error?.issues.map(({ code, path, message }) => ({
        code,
        path,
        message,
      }))
    ).toEqual([
      {
        code: "custom",
        path: ["ops", 1, "op"],
        message: "Unknown op setTheme",
      },
      {
        code: "unrecognized_keys",
        path: ["ops", 2],
        message: 'Unrecognized key: "at"',
      },
      {
        code: "too_small",
        path: ["ops", 3, "label"],
        message: "Too small: expected string to have >=1 characters",
      },
    ])
  })

  it("doesn't copy op values into issues", () => {
    const result = validateOverlay(
      overlay([
        { op: "setTheme", target: "orders-table", secret: "s3cr3t" },
        {
          op: "rename",
          target: "orders-table/columns/notes",
          label: "",
          secret: "s3cr3t",
        },
        { op: "hide", target: "orders-table/columns/notes", secret: "s3cr3t" },
      ])
    )
    expect(result.success).toBe(false)
    expect(JSON.stringify(result.error?.issues)).not.toContain("s3cr3t")
  })

  it("reports op issues along with envelope issues", () => {
    const result = validateOverlay({
      ...overlay([
        { op: "hide", target: "orders-table/columns/notes" },
        { op: "rename", target: "orders-table/columns/notes", label: "" },
      ]),
      basis: { contract: 1, core: "0.1.0", manifests: { "Bad Key": 1 } },
    })
    expect(result.error?.issues.map(({ path }) => path)).toEqual([
      ["basis", "manifests", "Bad Key"],
      ["ops", 1, "label"],
    ])
  })

  it("keeps each op's position when other ops fail the envelope", () => {
    const result = validateOverlay({
      ...overlay([
        { op: 5 },
        { op: "rename", target: "orders-table/columns/notes", label: "" },
      ]),
      v: 2,
    })
    expect(result.error?.issues.map(({ path }) => path.join("."))).toEqual([
      "v",
      "ops.0.op",
      "ops.0.target",
      "ops.1.label",
    ])
  })

  function overLimit(malformedFirst = false) {
    return Array.from({ length: 501 }, (_, index) =>
      malformedFirst && index === 0
        ? { op: 5 }
        : { op: "rename", target: "orders-table/columns/notes", label: "" }
    )
  }

  it.each([
    ["on its own", {}, false],
    ["with another envelope issue", { v: 2 }, false],
  ])(
    "reports an over-limit list without checking ops one by one, %s",
    (_, change, malformedFirst) => {
      const result = validateOverlay({
        ...overlay(overLimit(malformedFirst)),
        ...change,
      })
      const paths = result.error?.issues.map(({ path }) => path) ?? []
      expect(paths).toContainEqual(["ops"])
      expect(paths.some((path) => path.length > 2)).toBe(false)
    }
  )

  it.each([
    ["without a layer", { layer: undefined }, false],
    ["with an unknown layer", { layer: "global" }, false],
    ["with a malformed op and no layer", { layer: undefined }, true],
  ])(
    "reports an over-limit list along with the layer issue, %s",
    (_, change, malformedFirst) => {
      const result = validateOverlay({
        ...overlay(overLimit(malformedFirst)),
        ...change,
      })
      expect(result.error?.issues.map(({ path }) => path)).toEqual([
        ["layer"],
        ["ops"],
      ])
    }
  )

  it("reports malformed ops along with the layer issue", () => {
    const result = validateOverlay({
      ...overlay([
        { op: 5 },
        { op: "rename", target: "orders-table/columns/notes", label: "" },
      ]),
      layer: undefined,
    })
    expect(result.error?.issues.map(({ path }) => path.join("."))).toEqual([
      "layer",
      "ops.0.op",
      "ops.0.target",
      "ops.1.label",
    ])
  })

  it("reads every overlay layer's shared list limit", () => {
    expect(
      new Set(overlaySchema.options.map((option) => option.shape.ops)).size
    ).toBe(1)
  })

  const lists = {
    valid: [{ op: "hide", target: "orders-table/columns/notes" }],
    small: [{ op: 5 }],
    large: overLimit(),
  }

  it.each<[string, object, (keyof typeof lists)[], string[]]>([
    [
      "without a layer",
      { layer: undefined },
      ["large", "small"],
      ["layer", "ops"],
    ],
    [
      "without a layer, small first",
      { layer: undefined },
      ["small", "large"],
      ["layer", "ops.0.op", "ops.0.target"],
    ],
    [
      "with another envelope issue",
      { v: 2 },
      ["valid", "large", "small"],
      ["v", "ops"],
    ],
  ])(
    "checks the same ops it read, when a getter changes them, %s",
    (_, change, sequence, paths) => {
      let reads = 0
      const result = validateOverlay({
        ...overlay([]),
        ...change,
        get ops() {
          const name = sequence[Math.min(reads, sequence.length - 1)] ?? "valid"
          reads++
          return lists[name]
        },
      })
      expect(result.error?.issues.map(({ path }) => path.join("."))).toEqual(
        paths
      )
    }
  )

  it.each([
    ["missing", {}],
    ["undefined", { ops: undefined }],
  ])("reports %s ops along with the layer issue", (_, change) => {
    const withoutOps = Object.fromEntries(
      Object.entries(overlay([])).filter(([key]) => key !== "ops")
    )
    const result = validateOverlay({
      ...withoutOps,
      layer: "global",
      ...change,
    })
    expect(result.error?.issues.map(({ path }) => path)).toEqual([
      ["layer"],
      ["ops"],
    ])
  })

  it("reports an over-limit list of malformed ops once", () => {
    const ops = Array.from({ length: 501 }, () => ({ op: 5 }))
    const result = validateOverlay(overlay(ops))
    expect(result.error?.issues.map(({ path }) => path)).toEqual([["ops"]])
  })

  it("fails when the envelope is invalid", () => {
    expect(validateOverlay({ ...overlay([]), v: 2 }).success).toBe(false)
  })
})
