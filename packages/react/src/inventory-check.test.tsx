import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { cleanup, render } from "@testing-library/react"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest"

import type { PliantInventory } from "./inventory-check"
import { localAdapter } from "./local-adapter"
import { PliantRoot } from "./pliant-root"
import { usePliantTable } from "./use-pliant-table"
import { useRegionSlots } from "./use-region-slots"

const surface = "/dashboard"
const slots = { revenue: <p>Revenue</p>, orders: <p>Orders</p> }

const otherSlots = { margin: <p>Margin</p> }

function Region({ id = "key-metrics" }: { id?: string }) {
  useRegionSlots(id, id === "key-metrics" ? slots : otherSlots)
  return null
}

interface Order {
  id: string
  customer: string
}

const features = tableFeatures({})
const helper = createColumnHelper<typeof features, Order>()
const columns = helper.columns([
  helper.accessor("id", {}),
  helper.accessor("customer", {}),
])

function Table() {
  useTable(usePliantTable({ features, data: [], columns }, { id: "orders" }))
  return null
}

function inventoryOf(...ids: string[]): PliantInventory {
  return { baseIds: { ids } }
}

let warn: MockInstance<typeof console.warn>

function warnings() {
  return warn.mock.calls.map(([message]) => String(message))
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe("the inventory warning", () => {
  it("warns once about each region or slot id the inventory doesn't list", () => {
    const { rerender } = render(
      <PliantRoot
        surface={surface}
        storage={localAdapter}
        inventory={inventoryOf("key-metrics", "revenue")}
      >
        <Region />
        <Region id="other-metrics" />
      </PliantRoot>
    )
    rerender(
      <PliantRoot
        surface={surface}
        storage={localAdapter}
        inventory={inventoryOf("key-metrics", "revenue")}
      >
        <Region />
      </PliantRoot>
    )

    const messages = warnings()
    expect(messages).toHaveLength(3)
    expect(messages.filter((m) => m.includes('"orders"'))).toHaveLength(1)
    expect(messages.some((m) => m.includes('"other-metrics"'))).toBe(true)
    expect(messages.some((m) => m.includes('"margin"'))).toBe(true)
    expect(messages.some((m) => m.includes('"revenue"'))).toBe(false)
    expect(messages.some((m) => m.includes('"key-metrics"'))).toBe(false)
    expect(messages[0]).toContain(`"${surface}"`)
    expect(messages[0]).toContain("npx pliantui scan")
  })

  it("warns about a table column the inventory doesn't list", () => {
    render(
      <PliantRoot
        surface={surface}
        storage={localAdapter}
        inventory={inventoryOf("orders", "orders/columns/id")}
      >
        <Table />
      </PliantRoot>
    )

    expect(warnings()).toEqual([
      expect.stringContaining('"orders/columns/customer" mounted'),
    ])
  })

  it("doesn't warn when the inventory lists every id", () => {
    render(
      <PliantRoot
        surface={surface}
        storage={localAdapter}
        inventory={inventoryOf(
          "key-metrics",
          "revenue",
          "orders",
          "orders/columns/id",
          "orders/columns/customer"
        )}
      >
        <Region />
        <Table />
      </PliantRoot>
    )

    expect(warn).not.toHaveBeenCalled()
  })

  it("doesn't warn without an inventory", () => {
    render(
      <PliantRoot surface={surface} storage={localAdapter}>
        <Region />
        <Table />
      </PliantRoot>
    )

    expect(warn).not.toHaveBeenCalled()
  })

  it("doesn't warn in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    render(
      <PliantRoot
        surface={surface}
        storage={localAdapter}
        inventory={inventoryOf()}
      >
        <Region />
        <Table />
      </PliantRoot>
    )

    expect(warn).not.toHaveBeenCalled()
  })

  it("says when it's given the whole inventory instead of an entry", () => {
    const whole: unknown = { [surface]: inventoryOf("key-metrics") }
    render(
      <PliantRoot
        surface={surface}
        storage={localAdapter}
        inventory={whole as PliantInventory}
      >
        <Region />
        <Table />
      </PliantRoot>
    )

    expect(warnings()).toEqual([
      expect.stringContaining(`inventory["${surface}"]`),
    ])
  })
})
