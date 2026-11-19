import { useLayoutEffect, type ReactNode } from "react"
import { act, cleanup, render } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PliantRoot } from "./pliant-root"
import type { PliantStore } from "./pliant-store"
import type { StorageAdapter } from "./storage-adapter"
import { usePliantRegion } from "./use-pliant-region"
import { usePliantStore } from "./use-pliant-store"

const surface = "/dashboard"

function storageWith(ops: readonly unknown[]): StorageAdapter {
  return {
    load: () => ({
      personal: [
        {
          v: 1,
          id: "01KAB0000000000000000000P1",
          surface,
          layer: "personal",
          ops,
          basis: { contract: 1, core: "0.0.0", manifests: {} },
          source: "manual",
          createdBy: "local",
          createdAt: "2026-11-19T00:00:00.000Z",
        },
      ],
    }),
    save: () => undefined,
  }
}

const slots = { revenue: "Revenue", orders: "Orders", overdue: "Overdue" }

let store: PliantStore | undefined

function Region({
  id = "key-metrics",
  slots: declared = slots,
}: {
  id?: string
  slots?: Record<string, ReactNode>
}) {
  const actions = usePliantStore()
  useLayoutEffect(() => {
    store = actions
  }, [actions])
  const region = usePliantRegion(id, declared)
  return <output data-region={id}>{JSON.stringify(region)}</output>
}

function resolved(id = "key-metrics"): unknown {
  return JSON.parse(
    document.querySelector(`[data-region="${id}"]`)?.textContent ?? "null"
  )
}

const base = {
  layout: {},
  entries: [
    { kind: "slot", id: "revenue", visible: true },
    { kind: "slot", id: "orders", visible: true },
    { kind: "slot", id: "overdue", visible: true },
  ],
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  store = undefined
  vi.restoreAllMocks()
})

describe("usePliantRegion", () => {
  it("resolves the region with the stored layers", async () => {
    render(
      <PliantRoot
        surface={surface}
        storage={storageWith([
          { op: "setLayout", target: "key-metrics", mode: "grid", columns: 3 },
          { op: "hide", target: "key-metrics/slots/orders" },
        ])}
      >
        <Region />
      </PliantRoot>
    )
    await act(() => Promise.resolve())

    expect(resolved()).toEqual({
      layout: { md: { mode: "grid", columns: 3 } },
      entries: [
        { kind: "slot", id: "revenue", visible: true },
        { kind: "slot", id: "orders", visible: false },
        { kind: "slot", id: "overdue", visible: true },
      ],
    })
  })

  it("resolves again when an op applies", async () => {
    render(
      <PliantRoot surface={surface} storage={storageWith([])}>
        <Region />
      </PliantRoot>
    )
    await act(() => Promise.resolve())

    act(() => {
      store?.applyOps("session", [
        {
          op: "move",
          target: "key-metrics/slots/revenue",
          to: { after: "overdue" },
        },
      ])
    })

    expect(resolved()).toMatchObject({
      entries: [{ id: "orders" }, { id: "overdue" }, { id: "revenue" }],
    })
  })

  it("is the slots in key order while the layers load", () => {
    render(
      <PliantRoot
        surface={surface}
        storage={{
          load: () => new Promise(() => undefined),
          save: () => undefined,
        }}
      >
        <Region />
      </PliantRoot>
    )

    expect(resolved()).toEqual(base)
  })

  it("is the slots in key order on the server", () => {
    const html = renderToString(
      <PliantRoot surface={surface} storage={storageWith([])}>
        <Region />
      </PliantRoot>
    )
    const output = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector("output")

    expect(JSON.parse(output?.textContent ?? "null")).toEqual(base)
  })

  it("takes a slot moved in from another region", async () => {
    render(
      <PliantRoot
        surface={surface}
        storage={storageWith([
          {
            op: "move",
            target: "key-metrics/slots/overdue",
            to: { into: "sidebar" },
          },
        ])}
      >
        <Region />
        <Region id="sidebar" slots={{ notes: "Notes" }} />
      </PliantRoot>
    )
    await act(() => Promise.resolve())

    expect(resolved()).toMatchObject({
      entries: [{ id: "revenue" }, { id: "orders" }],
    })
    expect(resolved("sidebar")).toMatchObject({
      entries: [{ id: "notes" }, { id: "overdue" }],
    })
  })

  it("warns about slot keys that aren't kebab-case and duplicate ids", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    render(
      <PliantRoot surface={surface} storage={storageWith([])}>
        <Region slots={{ "2024": "Year" }} />
        <Region slots={{ revenue: "Revenue" }} />
      </PliantRoot>
    )
    await act(() => Promise.resolve())

    expect(warn.mock.calls).toEqual([
      [
        'Pliant: region "key-metrics" has a slot "2024". Slot ids must be kebab-case and start with a letter: keys that look like numbers change the base order.',
      ],
      [
        'Pliant: two mounted regions use the id "key-metrics". Region ids must be unique within a surface.',
      ],
    ])
  })
})
