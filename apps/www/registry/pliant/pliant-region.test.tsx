// @vitest-environment happy-dom
import * as React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
  return {
    load: () => ({
      personal: ops.length
        ? [
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
          ]
        : [],
    }),
    save: () => undefined,
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
  children: React.ReactNode = (
    <PliantRegion id="key-metrics" slots={slots} className="grid gap-6" />
  )
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
  it("renders each slot in a display: contents wrapper, in key order", async () => {
    await renderRegion()

    expect(idsIn(region())).toEqual(["revenue", "orders", "overdue"])
    for (const wrapper of region().children) {
      expect(wrapper instanceof HTMLElement && wrapper.style.display).toBe(
        "contents"
      )
    }
    expect(region().getAttribute("data-slot")).toBe("pliant-region")
    expect(region().className).toBe("flex-col grid gap-6")
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

  it("hides slots with Activity and keeps their state", async () => {
    await renderRegion()
    fireEvent.click(screen.getByRole("button", { name: "Orders 0" }))

    apply({ op: "hide", target: slot("orders") })
    const wrapper = region().children[1]
    expect(wrapper?.getAttribute("data-pliant-id")).toBe("orders")
    expect(wrapper instanceof HTMLElement && wrapper.style.display).toBe("none")
    expect(screen.queryByRole("button", { name: "Orders 1" })).toBeNull()

    apply({ op: "show", target: slot("orders") })
    expect(wrapper instanceof HTMLElement && wrapper.style.display).toBe(
      "contents"
    )
    expect(screen.getByRole("button", { name: "Orders 1" })).toBeTruthy()
  })

  it("renders a wrapper as a nested layout container", async () => {
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
    expect(wrapper.className).toBe(
      "flex flex-col gap-[inherit] md:grid md:grid-cols-2 lg:grid lg:grid-cols-2 xl:grid xl:grid-cols-2 2xl:grid 2xl:grid-cols-2"
    )
  })

  it("applies layouts from their breakpoint up, over the developer's", async () => {
    render(
      <PliantRoot
        surface={surface}
        storage={storageWith([
          { op: "setLayout", target: "key-metrics", mode: "grid", columns: 3 },
          { op: "span", target: slot("revenue"), columns: 2, at: "lg" },
        ])}
      >
        <PliantRegion
          id="key-metrics"
          slots={slots}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        />
      </PliantRoot>
    )
    await mounted()

    expect(region().className).toBe(
      "flex-col grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid md:grid-cols-3 lg:grid lg:grid-cols-3 xl:grid xl:grid-cols-3 2xl:grid 2xl:grid-cols-3"
    )
    expect(region("revenue").className).toBe("lg:*:col-span-2")
    expect(region("orders").hasAttribute("class")).toBe(false)
  })

  it("keeps a single column on mobile unless a layout targets it", async () => {
    await renderRegion([
      {
        op: "setLayout",
        target: "key-metrics",
        mode: "row",
        align: "center",
        at: "base",
      },
    ])

    expect(region().className).toContain("flex flex-row items-center")
  })

  it("groups collapsed slots in a disclosure that keeps their state", async () => {
    await renderRegion([
      {
        op: "collapse",
        target: "key-metrics",
        items: ["orders", "overdue"],
        into: "more",
        label: "More metrics",
      },
    ])
    const trigger = screen.getByRole("button", { name: "More metrics" })
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByRole("button", { name: "Orders 0" })).toBeNull()

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole("button", { name: "Orders 0" }))
    fireEvent.click(trigger)
    fireEvent.click(trigger)

    expect(screen.getByRole("button", { name: "Orders 1" })).toBeTruthy()
    expect(
      [...region().querySelectorAll("[data-pliant-id]")].map((element) =>
        element.getAttribute("data-pliant-id")
      )
    ).toEqual(["revenue", "orders", "overdue"])
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

  it("renders the base order while the layers load", () => {
    const storage: StorageAdapter = {
      load: () => new Promise(() => undefined),
      save: () => undefined,
    }
    render(
      <PliantRoot surface={surface} storage={storage}>
        <PliantRegion id="key-metrics" slots={slots} />
      </PliantRoot>
    )

    expect(region().getAttribute("data-pliant-pending")).toBe("")
    expect(idsIn(region())).toEqual(["revenue", "orders", "overdue"])
  })

  it("renders the base order on the server", () => {
    const html = renderToString(
      <PliantRoot surface={surface} storage={storageWith([])}>
        <PliantRegion id="key-metrics" slots={{ revenue: "Revenue" }} />
      </PliantRoot>
    )

    expect(html).toBe(
      '<div data-slot="pliant-region" data-pliant-id="key-metrics" data-pliant-pending="" class="flex flex-col gap-4"><!--&--><div data-pliant-id="revenue" style="display:contents">Revenue</div><!--/&--></div>'
    )
  })

  it("warns about slot keys that aren't kebab-case and duplicate ids", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    await renderRegion(
      [],
      <>
        <PliantRegion id="key-metrics" slots={{ "2024": "Year" }} />
        <PliantRegion id="key-metrics" slots={{ revenue: "Revenue" }} />
      </>
    )

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
