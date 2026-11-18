import { describe, expect, it } from "vitest"

import { overlaySchema } from "@pliantui/contract"

import { loadOverlay } from "./load-overlay"
import { resolveLayers } from "./resolve-layers"
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

  it.each<[string, object, unknown[], string[]]>([
    [
      "the layer rule when another field fails",
      { v: 2 },
      [{ op: "setPage", target: "orders-table", index: 1 }],
      ["v", "ops.0.op"],
    ],
    [
      "the @app rule when another field fails",
      { v: 2 },
      [{ op: "setTextScale", target: "@app", scale: 1.25 }],
      ["v", "ops.0.target"],
    ],
    [
      "only the @app rule when the layer is invalid",
      { layer: "global" },
      [
        { op: "setPage", target: "orders-table", index: 1 },
        { op: "setTextScale", target: "@app", scale: 1.25 },
      ],
      ["layer", "ops.1.target"],
    ],
    [
      "only the layer rule when the surface is invalid",
      { surface: "orders/x" },
      [
        { op: "setPage", target: "orders-table", index: 1 },
        { op: "setTextScale", target: "@app", scale: 1.25 },
      ],
      ["surface", "ops.0.op"],
    ],
  ])("applies %s", (_, change, ops, paths) => {
    const result = validateOverlay({ ...overlay(ops), ...change })
    expect(result.error?.issues.map(({ path }) => path.join("."))).toEqual(
      paths
    )
  })

  it("reports only the root issue for an array", () => {
    expect(validateOverlay([]).error?.issues.map(({ path }) => path)).toEqual([
      [],
    ])
  })

  it("reports a reserved key in an op once", () => {
    const result = validateOverlay(
      overlay([
        JSON.parse('{"op":"hide","target":"orders-table","__proto__":{}}'),
      ])
    )
    expect(
      result.error?.issues.map(({ path, message }) => ({ path, message }))
    ).toEqual([
      {
        path: ["ops", 0, "__proto__"],
        message: "Must not have a __proto__ key",
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
    ["on its own", {}, [["ops"]]],
    ["with another envelope issue", { v: 2 }, [["v"], ["ops"]]],
    [
      "with a nested envelope issue",
      { basis: { contract: 1, core: "0.1.0", manifests: { "Bad Key": 1 } } },
      [["ops"], ["basis", "manifests", "Bad Key"]],
    ],
  ])(
    "reports an over-limit list without checking ops one by one, %s",
    (_, change, paths) => {
      const result = validateOverlay({ ...overlay(overLimit()), ...change })
      expect(result.error?.issues.map(({ path }) => path)).toEqual(paths)
    }
  )

  it("keeps the contract's op issues when the list is within the limit", () => {
    const result = validateOverlay(
      overlay([{ op: "setTextScale", target: "@app", scale: 1.25 }])
    )
    expect(
      result.error?.issues.map(({ code, path }) => ({ code, path }))
    ).toContainEqual({ code: "custom", path: ["ops", 0, "target"] })
  })

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
      new Set(overlaySchema.out.options.map((option) => option.shape.ops)).size
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
      ["v"],
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
    expect(
      result.error?.issues.map(({ code, path }) => ({ code, path }))
    ).toEqual([
      { code: "invalid_union", path: ["layer"] },
      { code: "invalid_type", path: ["ops"] },
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

  describe("with resolved layers", () => {
    const wrap = (target: string, id: string) => ({
      op: "wrap",
      target,
      id,
      items: ["a", "b"],
      mode: "row",
    })
    const insert = (id: string, target = "page") => ({
      op: "insert",
      target,
      node: { id, kind: "chart", dataset: "orders" },
      at: { index: 0 },
    })
    const remove = (id: string) => ({
      op: "remove",
      target: `page/slots/${id}`,
    })
    const resolved = (layer: string, ops: unknown[]) => {
      const loaded = loadOverlay({
        ...overlay(ops),
        id: "01JBQ3V8Z7XKQ2M4N5P6R7S8A0",
        layer,
        ...(layer === "team" && { scope: { team: "sales" } }),
      })
      if (!loaded.success) {
        throw loaded.error
      }
      return resolveLayers([loaded.data], { surface: "/orders/[id]" })
    }

    it("rejects a wrap id already used on the surface", () => {
      const result = validateOverlay(
        overlay([
          { op: "hide", target: "orders-table/columns/notes" },
          wrap("dashboard", "pair"),
          wrap("dashboard", "orders"),
        ]),
        {
          resolved: resolved("team", [
            wrap("dashboard", "pair"),
            { op: "hide", target: "dashboard/slots/orders" },
          ]),
        }
      )
      expect(result.error?.issues).toEqual([
        {
          code: "custom",
          path: ["ops", 1, "id"],
          message: "The id pair is already used on this surface",
        },
        {
          code: "custom",
          path: ["ops", 2, "id"],
          message: "The id orders is already used on this surface",
        },
      ])
    })

    it("rejects reusing an id the overlay itself wrapped elsewhere", () => {
      const result = validateOverlay(
        overlay([wrap("dashboard", "pair"), wrap("sidebar", "pair")]),
        { resolved: resolved("personal", [{ op: "hide", target: "page" }]) }
      )
      expect(result.error?.issues.map(({ path }) => path)).toEqual([
        ["ops", 1, "id"],
      ])
    })

    it("lets the same scope replace its own wrap", () => {
      const ops = [wrap("dashboard", "pair")]
      expect(
        validateOverlay(overlay(ops), { resolved: resolved("personal", ops) })
          .success
      ).toBe(true)
      expect(
        validateOverlay(overlay([wrap("dashboard", "dashboard")])).success
      ).toBe(true)
    })

    it("rejects an insert id already used on the surface", () => {
      const result = validateOverlay(
        overlay([insert("pair"), insert("orders"), insert("chart")]),
        {
          resolved: resolved("team", [
            wrap("dashboard", "pair"),
            { op: "hide", target: "dashboard/slots/orders" },
          ]),
        }
      )
      expect(result.error?.issues).toEqual([
        {
          code: "custom",
          path: ["ops", 0, "node", "id"],
          message: "The id pair is already used on this surface",
        },
        {
          code: "custom",
          path: ["ops", 1, "node", "id"],
          message: "The id orders is already used on this surface",
        },
      ])
    })

    it.each<[string, unknown[], unknown[], number[]]>([
      [
        "a base id only an unapplied op points at",
        [{ op: "remove", target: "dashboard/slots/foo" }],
        [wrap("page", "foo")],
        [0],
      ],
      [
        "an id the overlay inserts first",
        [{ op: "hide", target: "page" }],
        [insert("chart"), wrap("page", "chart")],
        [1],
      ],
      [
        "an id the overlay inserts and removes",
        [{ op: "hide", target: "page" }],
        [insert("chart"), remove("chart"), wrap("page", "chart")],
        [],
      ],
      [
        "a lower insert the overlay re-inserts and removes",
        [insert("chart")],
        [insert("chart"), remove("chart"), wrap("page", "chart")],
        [2],
      ],
      [
        "another scope's wrap",
        [wrap("dashboard", "pair")],
        [wrap("dashboard", "pair"), wrap("page", "free")],
        [0],
      ],
      [
        "its own wrap at two targets",
        [{ op: "hide", target: "page" }],
        [wrap("dashboard", "pair"), wrap("page", "pair")],
        [1],
      ],
      [
        "an insert over a lower wrap",
        [wrap("dashboard", "pair")],
        [insert("pair")],
        [0],
      ],
      [
        "an insert of a base id",
        [{ op: "hide", target: "dashboard/slots/orders" }],
        [insert("orders", "dashboard")],
        [0],
      ],
      [
        "an insert at another target than a lower insert",
        [insert("chart")],
        [insert("chart", "dashboard")],
        [0],
      ],
      [
        "a re-insert at the same target",
        [insert("chart")],
        [insert("chart", "shell/slots/page")],
        [],
      ],
      [
        "a wrap over its own insert, then a re-insert",
        [{ op: "hide", target: "page" }],
        [insert("chart"), wrap("dashboard", "chart"), insert("chart")],
        [1],
      ],
      [
        "an insert of a removed wrapper's id",
        [wrap("page", "pair"), { op: "remove", target: "pair" }],
        [insert("pair")],
        [],
      ],
    ])("agrees with resolveLayers on %s", (_, lower, ops, expected) => {
      const input = { ...overlay(ops), id: "01JBQ3V8Z7XKQ2M4N5P6R7S8B0" }
      const loaded = loadOverlay(input)
      if (!loaded.success) {
        throw loaded.error
      }
      const below = resolved("team", lower)
      const validated = validateOverlay(input, { resolved: below })
      const resolvedAfter = resolveLayers(
        [
          ...below.skipped.map(({ overlay }) => overlay),
          ...below.unapplied.map(({ overlay }) => overlay),
          ...[...below.properties.values()].flatMap((node) =>
            [...node.values()].map(({ winner }) => winner.overlay)
          ),
          loaded.data,
        ].filter((item, index, all) => all.indexOf(item) === index),
        { surface: "/orders/[id]" }
      )

      expect(validated.error?.issues.map(({ path }) => path[1]) ?? []).toEqual(
        expected
      )
      expect(
        resolvedAfter.unapplied
          .filter(
            ({ overlay, reason }) =>
              overlay === loaded.data && reason === "id-collision"
          )
          .map(({ check }) => check.index)
      ).toEqual(expected)
    })
  })
})
