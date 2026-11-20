// @vitest-environment happy-dom
import * as React from "react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Overlay } from "@pliantui/contract"
import {
  PliantRoot,
  usePliantStore,
  type PliantStore,
  type StorageAdapter,
} from "@pliantui/react"

import { PliantRegion } from "./pliant-region"

const surface = "/dashboard"

type Op = Parameters<PliantStore["applyOps"]>[1][number]

function storageWith(ops: readonly unknown[]): StorageAdapter {
  const overlay: Overlay = {
    v: 1,
    id: "01KAB0000000000000000000P1",
    surface,
    layer: "personal",
    ops: [...ops],
    basis: { contract: 1, core: "0.0.0", manifests: {} },
    source: "manual",
    createdBy: "local",
    createdAt: "2026-11-19T00:00:00.000Z",
  }
  return {
    load: () => ({
      personal: ops.length
        ? [
            {
              overlay,
              etag: "1",
              version: 1,
              updatedAt: "2026-11-19T00:00:00.000Z",
            },
          ]
        : [],
    }),
    save: (_surface, saved) => ({
      overlay: saved,
      etag: crypto.randomUUID(),
      version: 1,
      updatedAt: new Date().toISOString(),
    }),
  }
}

function Counter({ label }: { label: string }) {
  const [count, setCount] = React.useState(0)
  return (
    <button
      type="button"
      onClick={() => {
        setCount(count + 1)
      }}
    >
      {label} {count}
    </button>
  )
}

const slots = {
  revenue: <Counter label="Revenue" />,
  orders: <Counter label="Orders" />,
  overdue: <Counter label="Overdue" />,
}

let store: PliantStore | undefined

function Store() {
  const actions = usePliantStore()
  React.useLayoutEffect(() => {
    store = actions
  }, [actions])
  return null
}

async function renderRegion(
  ops: readonly unknown[] = [],
  children: React.ReactNode = <PliantRegion id="key-metrics" slots={slots} />
) {
  render(
    <PliantRoot surface={surface} storage={storageWith(ops)}>
      <Store />
      {children}
    </PliantRoot>
  )
  await mounted()
}

async function mounted() {
  await act(() => Promise.resolve())
}

function apply(...ops: Op[]) {
  act(() => {
    const result = store?.applyOps("session", ops)
    expect(result?.success).toBe(true)
  })
}

function region(id = "key-metrics") {
  const element = document.querySelector(`[data-pliant-id="${id}"]`)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`No region ${id}`)
  }
  return element
}

function idsIn(element: Element) {
  return [...element.children].map((child) =>
    child.getAttribute("data-pliant-id")
  )
}

const slot = (id: string, region = "key-metrics") => `${region}/slots/${id}`

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  store = undefined
  vi.restoreAllMocks()
})

describe("PliantRegion", () => {
  it("renders the slots in key order", async () => {
    await renderRegion()

    expect(idsIn(region())).toEqual(["revenue", "orders", "overdue"])
    expect(
      screen.getAllByRole("button").map((button) => button.textContent)
    ).toEqual(["Revenue 0", "Orders 0", "Overdue 0"])
  })

  it("reorders slots and keeps their state and focus", async () => {
    await renderRegion()
    const revenue = screen.getByRole("button", { name: "Revenue 0" })
    fireEvent.click(revenue)
    revenue.focus()

    apply({ op: "move", target: slot("revenue"), to: { after: "overdue" } })

    expect(idsIn(region())).toEqual(["orders", "overdue", "revenue"])
    expect(
      screen.getAllByRole("button").map((button) => button.textContent)
    ).toEqual(["Orders 0", "Overdue 0", "Revenue 1"])
    expect(document.activeElement).toBe(revenue)
  })

  it("hides slots and keeps their state", async () => {
    await renderRegion()
    fireEvent.click(screen.getByRole("button", { name: "Orders 0" }))

    apply({ op: "hide", target: slot("orders") })
    expect(screen.queryByRole("button", { name: "Orders 1" })).toBeNull()

    apply({ op: "show", target: slot("orders") })
    expect(screen.getByRole("button", { name: "Orders 1" })).toBeTruthy()
  })

  it("renders a wrapper as a nested container", async () => {
    await renderRegion([
      {
        op: "wrap",
        target: "key-metrics",
        id: "money",
        items: ["revenue", "overdue"],
        mode: "grid",
        columns: 2,
      },
    ])

    expect(idsIn(region())).toEqual(["money", "orders"])
    const wrapper = region("money")
    expect(idsIn(wrapper)).toEqual(["revenue", "overdue"])
  })

  it("collapses slots behind a trigger and keeps their state", async () => {
    await renderRegion()
    fireEvent.click(screen.getByRole("button", { name: "Orders 0" }))

    apply({
      op: "collapse",
      target: "key-metrics",
      items: ["orders", "overdue"],
      into: "more",
      label: "More metrics",
    })
    const trigger = screen.getByRole("button", { name: "More metrics" })
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByRole("button", { name: "Orders 1" })).toBeNull()

    fireEvent.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    fireEvent.click(screen.getByRole("button", { name: "Orders 1" }))
    fireEvent.click(trigger)
    fireEvent.click(trigger)

    expect(screen.getByRole("button", { name: "Orders 2" })).toBeTruthy()
  })

  it("keeps rendering a slot moved out of a region it hides or collapses", async () => {
    const page = (
      <PliantRegion
        id="outer"
        slots={{
          top: <p>Top</p>,
          details: <PliantRegion id="inner" slots={{ card: <p>Card</p> }} />,
        }}
      />
    )
    await renderRegion(
      [{ op: "move", target: slot("card", "inner"), to: { into: "outer" } }],
      page
    )
    expect(idsIn(region("outer"))).toEqual(["top", "details", "card"])

    apply({ op: "hide", target: slot("details", "outer") })
    await mounted()
    expect(region("card").textContent).toBe("Card")

    apply(
      { op: "show", target: slot("details", "outer") },
      { op: "collapse", target: "outer", items: ["details"], into: "more" }
    )
    await mounted()
    expect(region("card").textContent).toBe("Card")
  })

  it("renders a slot moved in from another region, and not in its own", async () => {
    await renderRegion(
      [{ op: "move", target: slot("overdue"), to: { into: "sidebar" } }],
      <>
        <PliantRegion id="key-metrics" slots={slots} />
        <PliantRegion id="sidebar" slots={{ notes: <p>Notes</p> }} />
      </>
    )

    expect(idsIn(region())).toEqual(["revenue", "orders"])
    expect(idsIn(region("sidebar"))).toEqual(["notes", "overdue"])
    expect(region("overdue").textContent).toBe("Overdue 0")
  })

  it("shows a placeholder for an inserted node", async () => {
    await renderRegion([
      {
        op: "insert",
        target: "key-metrics",
        node: { id: "trend", kind: "chart", dataset: "orders", label: "Trend" },
        at: { index: 0 },
      },
    ])

    expect(idsIn(region())).toEqual(["trend", "revenue", "orders", "overdue"])
    expect(region("trend").textContent).toBe("Trend can't be shown yet")
  })

  it("renders the base order on the server", () => {
    const container = document.createElement("div")
    container.innerHTML = renderToString(
      <PliantRoot surface={surface} storage={storageWith([])}>
        <PliantRegion id="key-metrics" slots={slots} />
      </PliantRoot>
    )

    expect(
      within(container)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Revenue 0", "Orders 0", "Overdue 0"])
  })
})
