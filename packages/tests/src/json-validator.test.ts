import { describe, expect, it } from "vitest"

import { manifestSchema, savedViewSchema } from "@pliantui/contract"
import { loadOverlay, validateOverlay } from "@pliantui/core"

import {
  readFixture,
  readOpFixtures,
  type Fixture,
} from "../../contract/test/fixtures"
import {
  isImportValid,
  isManifestValid,
  isOverlayValid,
  isSavedViewValid,
  opStatus,
  opStatuses,
  type Status,
} from "./json-validator"

function valuesOf({ valid, invalid, crossField }: Fixture) {
  return [...valid, ...invalid, ...crossField.map(({ value }) => value)]
}

const base = {
  v: 1,
  id: "01JBQ3V8Z7XKQ2M4N5P6R7S8T9",
  basis: { contract: 1, core: "0.1.0", manifests: {} },
  source: "manual",
  createdBy: "user_123",
  createdAt: "2026-11-01T09:30:00.000Z",
}

const contexts = [
  { layer: "personal", surface: "/orders/[id]" },
  { layer: "session", surface: "/orders/[id]" },
  { layer: "personal", surface: "@app" },
  { layer: "team", surface: "/orders/[id]", scope: { team: "support" } },
  { layer: "org", surface: "/orders/[id]", scope: { org: "acme" } },
]

const inlineOps = [
  { op: "setTheme", target: "orders-table" },
  { op: "setTheme", target: "@app" },
  { op: "setTheme", target: "Orders" },
  { op: "setTheme", target: `a${"b".repeat(256)}` },
  { op: `a${"b".repeat(64)}`, target: "orders-table" },
  { op: "Hide", target: "orders-table" },
  { op: 5, target: "orders-table" },
  null,
]

const ops = [
  ...[...readOpFixtures().values()].flatMap(valuesOf),
  ...inlineOps,
].flatMap((op) =>
  typeof op === "object" && op !== null && !Array.isArray(op)
    ? [op, { ...op, futureArgument: 1 }]
    : [op]
)

const overlays = [
  ...valuesOf(readFixture("overlay")),
  {
    ...base,
    layer: "personal",
    surface: "/orders",
    ops: [{ op: "hide", target: "orders-table" }],
    explain: ["One.", "Two."],
  },
]

describe("validating with the published JSON files", () => {
  it.each(contexts)(
    "gives every op the same status as core in %j",
    (context) => {
      const seen = new Set<Status>()
      for (const op of ops) {
        const status = opStatus(op, context.layer, context.surface)
        seen.add(status)
        expect(status, JSON.stringify(op)).toBe(
          loadOverlay({ ...base, ...context, ops: [op] }).data?.ops[0]?.status
        )
      }
      expect([...seen].sort()).toEqual(["invalid", "newer", "unknown", "valid"])
    }
  )

  it("loads the same overlays with the same op statuses as core", () => {
    for (const overlay of overlays) {
      const result = loadOverlay(overlay)
      expect(isOverlayValid(overlay), JSON.stringify(overlay)).toBe(
        result.success
      )
      expect(opStatuses(overlay), JSON.stringify(overlay)).toEqual(
        result.data?.ops.map(({ status }) => status) ?? []
      )
    }
  })

  it("accepts the same AI answers and imports as core", () => {
    for (const overlay of overlays) {
      expect(isImportValid(overlay), JSON.stringify(overlay)).toBe(
        validateOverlay(overlay).success
      )
    }
  })

  it("accepts the same saved views as the contract", () => {
    for (const view of valuesOf(readFixture("saved-view"))) {
      expect(isSavedViewValid(view), JSON.stringify(view)).toBe(
        savedViewSchema.safeParse(view).success
      )
    }
  })

  it("accepts the same manifests as the contract", () => {
    for (const manifest of valuesOf(readFixture("manifest"))) {
      expect(isManifestValid(manifest), JSON.stringify(manifest)).toBe(
        manifestSchema.safeParse(manifest).success
      )
    }
  })
})
