import { describe, expect, it } from "vitest"
import * as z from "zod"

import type { Layer } from "@pliantui/contract"

import { loadOverlay, type LoadedOverlay } from "./load-overlay"
import {
  resolveLayers,
  type ResolvedLayers,
  type ResolveLayersOptions,
} from "./resolve-layers"
import { validateOverlay } from "./validate-overlay"

const surface = "/tickets"

const scopes = {
  org: { org: "acme" },
  team: { team: "sales" },
} as const

let count = 0

function stored(layer: Layer, ops: unknown[]) {
  count++
  return {
    v: 1,
    id: `01JBQ3V8Z7XKQ2M4N5P6${String(count).padStart(6, "0")}`,
    surface,
    layer,
    ...((layer === "org" || layer === "team") && { scope: scopes[layer] }),
    ops,
    basis: { contract: 1, core: "0.1.0", manifests: {} },
    source: "manual",
    createdBy: "user_123",
    createdAt: "2026-11-01T09:30:00.000Z",
  }
}

function overlay(layer: Layer, ops: unknown[]): LoadedOverlay {
  const result = loadOverlay(stored(layer, ops))
  if (!result.success) {
    throw result.error
  }
  return result.data
}

function skips({ skipped }: ResolvedLayers) {
  return skipped.flatMap((entry) =>
    entry.reason === "guardrail"
      ? [
          {
            layer: entry.overlay.layer,
            guardrail: entry.guardrail,
            node: entry.node,
          },
        ]
      : []
  )
}

const priority = "page/slots/ticket-form/fields/priority"
const due = "page/slots/ticket-form/fields/due"

const fields = {
  [priority]: z.enum(["low", "high"]),
  [due]: z.iso.date().nullable(),
}

const setDefault = (target: string, value: unknown) => ({
  op: "setDefault",
  target,
  value,
})

function resolve(
  overlays: LoadedOverlay[],
  options: Partial<ResolveLayersOptions> = {}
) {
  return resolveLayers(overlays, { surface, fields, ...options })
}

const defaultOf = (result: ResolvedLayers, id: string) => {
  const op = result.properties.get(id)?.get("default")?.winner.check.op
  return op?.op === "setDefault" ? op.value : undefined
}

describe("form field defaults", () => {
  it("applies a default the field's schema accepts", () => {
    const result = resolve([
      overlay("personal", [
        setDefault(priority, "high"),
        setDefault(due, "2026-12-01"),
      ]),
    ])
    expect(defaultOf(result, "ticket-form/fields/priority")).toBe("high")
    expect(defaultOf(result, "ticket-form/fields/due")).toBe("2026-12-01")
    expect(result.skipped).toEqual([])
  })

  it("applies null when the schema accepts it", () => {
    const result = resolve([overlay("personal", [setDefault(due, null)])])
    expect(
      result.properties.get("ticket-form/fields/due")?.has("default")
    ).toBe(true)
    expect(result.skipped).toEqual([])
  })

  it("skips a default the field's schema rejects, keeping the lower one", () => {
    const result = resolve([
      overlay("team", [setDefault(priority, "low")]),
      overlay("personal", [
        setDefault("ticket-form/fields/priority", "urgent"),
        setDefault(priority, null),
        setDefault(due, "next week"),
      ]),
    ])
    expect(defaultOf(result, "ticket-form/fields/priority")).toBe("low")
    expect(defaultOf(result, "ticket-form/fields/due")).toBeUndefined()
    expect(skips(result)).toEqual([
      {
        layer: "personal",
        guardrail: "valid-default",
        node: "ticket-form/fields/priority",
      },
      {
        layer: "personal",
        guardrail: "valid-default",
        node: "ticket-form/fields/priority",
      },
      {
        layer: "personal",
        guardrail: "valid-default",
        node: "ticket-form/fields/due",
      },
    ])
  })

  it("applies any default to a field with no schema", () => {
    const result = resolve([
      overlay("personal", [setDefault("ticket-form/fields/notes", 42)]),
    ])
    expect(defaultOf(result, "ticket-form/fields/notes")).toBe(42)
  })

  it("throws when a schema validates asynchronously", () => {
    const later = z.string().refine(async () => Promise.resolve(true))
    expect(() =>
      resolve([overlay("personal", [setDefault(priority, "high")])], {
        fields: { [priority]: later },
      })
    ).toThrow(
      new TypeError(
        "The schema of ticket-form/fields/priority must validate synchronously"
      )
    )
  })

  it("throws on fields that aren't schemas at field addresses", () => {
    const schema = z.string()
    expect(() =>
      resolve([], { fields: { "ticket-form/columns/a": schema } })
    ).toThrow(
      new TypeError(
        'fields["ticket-form/columns/a"] must be a schema at a field address'
      )
    )
    expect(() =>
      resolve([], { fields: { [priority]: {} as typeof schema } })
    ).toThrow(
      new TypeError(`fields["${priority}"] must be a schema at a field address`)
    )
    expect(() =>
      resolve([], {
        fields: { [priority]: schema, "ticket-form/fields/priority": schema },
      })
    ).toThrow(
      new TypeError("fields gives ticket-form/fields/priority two schemas")
    )
    expect(() =>
      resolve([], { fields: [] as unknown as Record<string, typeof schema> })
    ).toThrow(
      new TypeError("fields must be a plain object of schemas by address")
    )
  })

  it("rejects an overlay with a default the schema rejects", () => {
    const input = stored("personal", [
      setDefault(priority, "high"),
      setDefault(priority, "urgent"),
    ])
    const result = validateOverlay(input, {
      layers: { overlays: [], surface },
      fields,
    })
    expect(result.error?.issues).toEqual([
      {
        code: "custom",
        path: ["ops", 1],
        message:
          "The item ticket-form/fields/priority doesn't accept this default",
      },
    ])
    expect(() => validateOverlay(input, { fields: { a: z.string() } })).toThrow(
      new TypeError('fields["a"] must be a schema at a field address')
    )
  })

  it("rejects a default the schema rejects without the layers below", () => {
    const input = stored("personal", [
      setDefault(priority, "high"),
      setDefault(due, "next week"),
    ])
    expect(validateOverlay(input).success).toBe(true)
    expect(validateOverlay(input, { fields }).error?.issues).toEqual([
      {
        code: "custom",
        path: ["ops", 1],
        message: "The item ticket-form/fields/due doesn't accept this default",
      },
    ])
  })
})
