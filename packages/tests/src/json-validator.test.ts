import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { loadOverlay } from "@pliantui/core"

import { isOverlayValid, opStatus } from "./json-validator"

const fixtures = path.join(import.meta.dirname, "../../contract/test/fixtures")

function readFixture(file: string): unknown[] {
  const value: unknown = JSON.parse(
    readFileSync(path.join(fixtures, file), "utf8")
  )
  if (typeof value !== "object" || value === null) {
    return []
  }
  const entries = Object.fromEntries(Object.entries(value))
  const list = (key: string): unknown[] => {
    const items: unknown = entries[key]
    return Array.isArray(items) ? items : []
  }
  return [
    ...list("valid"),
    ...list("invalid"),
    ...list("crossField").map((entry) =>
      typeof entry === "object" && entry !== null && "value" in entry
        ? entry.value
        : entry
    ),
  ]
}

const ops = readdirSync(path.join(fixtures, "ops")).flatMap((file) =>
  readFixture(`ops/${file}`)
)
const overlays = readFixture("overlay.json")

const contexts = [
  { layer: "personal", surface: "/orders/[id]" },
  { layer: "session", surface: "/orders/[id]" },
  { layer: "personal", surface: "@app" },
  { layer: "team", surface: "/orders/[id]", scope: { team: "support" } },
]

function withExtraKey(op: unknown) {
  return typeof op === "object" && op !== null && !Array.isArray(op)
    ? { ...op, futureArgument: 1 }
    : op
}

function coreStatus(op: unknown, context: (typeof contexts)[number]) {
  const result = loadOverlay({
    v: 1,
    id: "01JBQ3V8Z7XKQ2M4N5P6R7S8T9",
    ops: [op],
    basis: { contract: 1, core: "0.1.0", manifests: {} },
    source: "manual",
    createdBy: "user_123",
    createdAt: "2026-11-01T09:30:00.000Z",
    ...context,
  })
  return result.data?.ops[0]?.status
}

describe("validating with the published JSON files", () => {
  it.each(contexts)(
    "gives every op fixture the same status as core in %j",
    (context) => {
      for (const op of ops.flatMap((op) => [op, withExtraKey(op)])) {
        expect(
          opStatus(op, context.layer, context.surface),
          JSON.stringify(op)
        ).toBe(coreStatus(op, context))
      }
    }
  )

  it("accepts and rejects the same overlay fixtures as core", () => {
    for (const overlay of overlays) {
      expect(isOverlayValid(overlay), JSON.stringify(overlay)).toBe(
        loadOverlay(overlay).success
      )
    }
  })
})
