import { describe, expect, it } from "vitest"
import * as z from "zod"

import { loadOverlay } from "./load-overlay"
import { resolveForm } from "./resolve-form"
import { resolveLayers, type ResolveLayersOptions } from "./resolve-layers"

const surface = "/tickets"
const fields = ["title", "priority", "cc", "due"]

function resolve(ops: unknown[], options: Partial<ResolveLayersOptions> = {}) {
  if (ops.length === 0) {
    return resolveForm(resolveLayers([], { surface }), {
      id: "ticket-form",
      fields,
    })
  }
  const loaded = loadOverlay({
    v: 1,
    id: "01JBQ3V8Z7XKQ2M4N5P6R70000",
    surface,
    layer: "personal",
    ops,
    basis: { contract: 1, core: "0.1.0", manifests: {} },
    source: "manual",
    createdBy: "user_123",
    createdAt: "2026-11-01T09:30:00.000Z",
  })
  if (!loaded.success) {
    throw loaded.error
  }
  const layers = resolveLayers([loaded.data], { surface, ...options })
  return resolveForm(layers, { id: "ticket-form", fields })
}

const order = (ops: unknown[]) => resolve(ops).entries.map((entry) => entry.id)

describe("resolveForm", () => {
  it("renders every field in base order, visible, with no defaults", () => {
    const form = resolve([])
    expect(form.entries).toEqual(
      fields.map((id) => ({ kind: "slot", id, visible: true }))
    )
    expect(form.defaults).toEqual(new Map())
  })

  it("moves fields within the form", () => {
    expect(
      order([
        {
          op: "move",
          target: "ticket-form/fields/due",
          to: { before: "title" },
        },
      ])
    ).toEqual(["due", "title", "priority", "cc"])
    expect(
      order([
        { op: "move", target: "ticket-form/fields/title", to: { index: 2 } },
      ])
    ).toEqual(["priority", "cc", "title", "due"])
    expect(
      order([
        { op: "pin", target: "page/slots/ticket-form/fields/cc", where: "end" },
      ])
    ).toEqual(["title", "priority", "due", "cc"])
  })

  it("ignores ops on other forms and on names that aren't fields", () => {
    expect(
      order([
        {
          op: "move",
          target: "other-form/fields/due",
          to: { before: "title" },
        },
        { op: "move", target: "ticket-form/fields/x", to: { before: "title" } },
        { op: "hide", target: "other-form/fields/title" },
      ])
    ).toEqual(fields)
    expect(
      resolve([{ op: "hide", target: "other-form/fields/title" }]).entries[0]
    ).toEqual({ kind: "slot", id: "title", visible: true })
  })

  it("keeps hidden fields in place, and reads pins", () => {
    const form = resolve([
      { op: "hide", target: "ticket-form/fields/priority" },
      { op: "pin", target: "ticket-form/fields/title", where: "sticky" },
    ])
    expect(form.entries).toEqual([
      { kind: "slot", id: "title", visible: true, pinned: "sticky" },
      { kind: "slot", id: "priority", visible: false },
      { kind: "slot", id: "cc", visible: true },
      { kind: "slot", id: "due", visible: true },
    ])
  })

  it("collapses fields in place, and undoes a collapse with none", () => {
    const form = resolve([
      {
        op: "collapse",
        target: "ticket-form",
        items: ["cc", "due"],
        into: "more",
        label: "More fields",
      },
      { op: "collapse", target: "ticket-form", items: ["due"], into: "none" },
    ])
    expect(form.entries.map((entry) => [entry.id, entry.collapsed])).toEqual([
      ["title", undefined],
      ["priority", undefined],
      ["cc", { into: "more", label: "More fields" }],
      ["due", undefined],
    ])
  })

  it("reads defaults, skipping those the field's schema rejects", () => {
    const form = resolve(
      [
        {
          op: "setDefault",
          target: "ticket-form/fields/priority",
          value: "high",
        },
        { op: "setDefault", target: "ticket-form/fields/due", value: "soon" },
        { op: "setDefault", target: "ticket-form/fields/cc", value: null },
      ],
      {
        fields: {
          "ticket-form/fields/priority": z.enum(["low", "high"]),
          "ticket-form/fields/due": z.iso.date(),
        },
      }
    )
    expect(form.defaults).toEqual(
      new Map<string, unknown>([
        ["priority", "high"],
        ["cc", null],
      ])
    )
  })

  it("keeps required fields visible", () => {
    const form = resolve(
      [
        { op: "hide", target: "ticket-form/fields/title" },
        {
          op: "collapse",
          target: "ticket-form",
          items: ["title"],
          into: "more",
        },
      ],
      { flags: { "ticket-form/fields/title": { required: true } } }
    )
    expect(form.entries[0]).toEqual({
      kind: "slot",
      id: "title",
      visible: true,
    })
  })
})
