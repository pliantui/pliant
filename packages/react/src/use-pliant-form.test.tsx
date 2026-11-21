import { useLayoutEffect } from "react"
import { act, cleanup, render, screen } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import * as z from "zod"

import { memoryStorage } from "../test/storage"
import { PliantRoot } from "./pliant-root"
import type { PliantStore } from "./pliant-store"
import type { StorageAdapter } from "./storage-adapter"
import { usePliantForm } from "./use-pliant-form"
import { usePliantFormDefaults } from "./use-pliant-form-defaults"
import { usePliantStore } from "./use-pliant-store"

const surface = "/tickets"

function overlay(ops: readonly unknown[], id = "01KAB0000000000000000000P1") {
  return {
    v: 1,
    id,
    surface,
    layer: "personal",
    ops,
    basis: { contract: 1, core: "0.0.0", manifests: {} },
    source: "manual",
    createdBy: "local",
    createdAt: "2026-11-19T00:00:00.000Z",
  }
}

function storageWith(
  ops: readonly unknown[],
  later: readonly unknown[] = []
): StorageAdapter {
  return memoryStorage({
    personal: [
      ...(ops.length === 0 ? [] : [overlay(ops)]),
      ...(later.length === 0
        ? []
        : [overlay(later, "01KAB0000000000000000000P2")]),
    ],
  }).storage
}

const schema = z.object({
  title: z.string().min(1),
  priority: z.enum(["low", "normal", "high"]),
  cc: z.email().optional(),
})

const initial = { title: "", priority: "normal", cc: undefined }

const fields = { title: "Title", priority: "Priority", cc: "CC" }

let store: PliantStore | undefined

function Form({ withSchema = true }: { withSchema?: boolean }) {
  const actions = usePliantStore()
  useLayoutEffect(() => {
    store = actions
  }, [actions])
  const options = withSchema ? { schema } : {}
  const values = usePliantFormDefaults("ticket-form", initial, options)
  const form = usePliantForm("ticket-form", fields, options)
  return (
    <>
      <output aria-label="values">{JSON.stringify(values)}</output>
      <ul aria-label="fields">
        {form.entries.map((entry) => (
          <li key={entry.id}>
            {[
              entry.id,
              entry.visible ? "visible" : "hidden",
              entry.collapsed?.into ?? "",
            ].join(" ")}
          </li>
        ))}
      </ul>
    </>
  )
}

function shown() {
  return screen.getAllByRole("listitem").map((item) => item.textContent)
}

function values(): unknown {
  return JSON.parse(screen.getByLabelText("values").textContent || "null")
}

async function load(
  ops: readonly unknown[],
  withSchema = true,
  later: readonly unknown[] = []
) {
  await act(async () => {
    render(
      <PliantRoot surface={surface} storage={storageWith(ops, later)}>
        <Form withSchema={withSchema} />
      </PliantRoot>
    )
    await Promise.resolve()
  })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  store = undefined
})

describe("usePliantForm", () => {
  it("renders the fields in key order on the server", () => {
    const html = renderToString(
      <PliantRoot
        surface={surface}
        storage={storageWith([
          { op: "move", target: "ticket-form/fields/cc", to: { index: 0 } },
        ])}
      >
        <Form />
      </PliantRoot>
    )
    const text = html.replaceAll(/<[^>]+>/g, "|")
    expect(text).toContain("title visible |")
    expect(text.indexOf("title")).toBeLessThan(text.indexOf("cc visible"))
  })

  it("orders, hides and collapses fields from the layers", async () => {
    await load([
      {
        op: "move",
        target: "ticket-form/fields/priority",
        to: { before: "title" },
      },
      { op: "collapse", target: "ticket-form", items: ["cc"], into: "more" },
    ])
    expect(shown()).toEqual([
      "priority visible ",
      "title visible ",
      "cc visible more",
    ])
    act(() => {
      store?.applyOps("personal", [
        { op: "hide", target: "ticket-form/fields/cc" },
      ])
    })
    expect(shown()[2]).toBe("cc hidden more")
  })

  it("keeps required fields visible and out of collapses", async () => {
    await load([
      {
        op: "collapse",
        target: "ticket-form",
        items: ["priority"],
        into: "more",
      },
    ])
    expect(shown()[1]).toBe("priority visible ")
    let result: ReturnType<PliantStore["applyOps"]> | undefined
    act(() => {
      result = store?.applyOps("personal", [
        { op: "hide", target: "ticket-form/fields/title" },
      ])
    })
    expect(result?.success).toBe(false)
    expect(shown()[0]).toBe("title visible ")
  })

  it("can hide any field without a schema", async () => {
    await load([{ op: "hide", target: "ticket-form/fields/title" }], false)
    expect(shown()[0]).toBe("title hidden ")
  })
})

describe("usePliantFormDefaults", () => {
  it("is the given values until the layers load", () => {
    const html = renderToString(
      <PliantRoot
        surface={surface}
        storage={storageWith([
          {
            op: "setDefault",
            target: "ticket-form/fields/priority",
            value: "high",
          },
        ])}
      >
        <Form />
      </PliantRoot>
    )
    expect(html).toContain("&quot;priority&quot;:&quot;normal&quot;")
  })

  it("puts the defaults the layers set over the given values", async () => {
    await load([
      {
        op: "setDefault",
        target: "ticket-form/fields/priority",
        value: "high",
      },
    ])
    expect(values()).toEqual({ title: "", priority: "high" })
  })

  it("skips a default the field's schema rejects", async () => {
    await load([
      {
        op: "setDefault",
        target: "ticket-form/fields/priority",
        value: "urgent",
      },
      { op: "setDefault", target: "ticket-form/fields/cc", value: "a@b.co" },
    ])
    expect(values()).toEqual({ title: "", priority: "normal", cc: "a@b.co" })
  })

  it("keeps an earlier default when a later one is rejected", async () => {
    await load(
      [
        {
          op: "setDefault",
          target: "ticket-form/fields/priority",
          value: "low",
        },
      ],
      true,
      [
        {
          op: "setDefault",
          target: "ticket-form/fields/priority",
          value: "urgent",
        },
      ]
    )
    expect(values()).toEqual({ title: "", priority: "low" })
  })

  it("leaves out fields the given values don't name", async () => {
    await load([
      { op: "setDefault", target: "ticket-form/fields/due", value: "x" },
    ])
    expect(values()).toEqual({ title: "", priority: "normal" })
  })
})
