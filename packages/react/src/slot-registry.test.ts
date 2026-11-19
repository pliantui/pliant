import { afterEach, describe, expect, it, vi } from "vitest"

import { createSlotRegistry } from "./slot-registry"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("createSlotRegistry", () => {
  it("returns the content of declared slots until they're undeclared", () => {
    const registry = createSlotRegistry()
    const undeclare = registry.declare({}, "dashboard", { revenue: "Revenue" })

    expect(registry.getContent("revenue")).toBe("Revenue")
    expect(registry.getContent("orders")).toBeUndefined()

    undeclare()
    expect(registry.getContent("revenue")).toBeUndefined()
  })

  it("notifies only the listeners of slots whose content changed", () => {
    const registry = createSlotRegistry()
    const revenue = vi.fn()
    const orders = vi.fn()
    registry.subscribe("revenue", revenue)
    registry.subscribe("orders", orders)

    const undeclare = registry.declare({}, "dashboard", {
      revenue: "Revenue",
      orders: "Orders",
    })
    expect(revenue).toHaveBeenCalledTimes(1)
    expect(orders).toHaveBeenCalledTimes(1)

    registry.declare({}, "sidebar", { filters: "Filters" })
    expect(revenue).toHaveBeenCalledTimes(1)

    undeclare()
    expect(revenue).toHaveBeenCalledTimes(2)
    expect(orders).toHaveBeenCalledTimes(2)
  })

  it("stops notifying after unsubscribing", () => {
    const registry = createSlotRegistry()
    const listener = vi.fn()
    const unsubscribe = registry.subscribe("revenue", listener)
    unsubscribe()

    registry.declare({}, "dashboard", { revenue: "Revenue" })
    expect(listener).not.toHaveBeenCalled()
  })

  it("keeps the first declaration of a slot declared twice", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const registry = createSlotRegistry()
    const undeclare = registry.declare({}, "dashboard", { revenue: "First" })
    registry.declare({}, "sidebar", { revenue: "Second" })

    expect(registry.getContent("revenue")).toBe("First")
    undeclare()
    expect(registry.getContent("revenue")).toBe("Second")
  })

  it("keeps the first owner's place when it declares again", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const registry = createSlotRegistry()
    const first = {}
    registry.declare(first, "dashboard", { revenue: "First" })()
    registry.declare({}, "sidebar", { revenue: "Second" })
    registry.declare(first, "dashboard", { revenue: "First again" })

    expect(registry.getContent("revenue")).toBe("First again")
  })

  it("replaces what an owner declared before", () => {
    const registry = createSlotRegistry()
    const owner = {}
    const listener = vi.fn()
    registry.subscribe("orders", listener)
    const undeclare = registry.declare(owner, "dashboard", {
      revenue: "Revenue",
      orders: "Orders",
    })
    registry.declare(owner, "dashboard", { revenue: "Revenue" })

    expect(registry.getContent("orders")).toBeUndefined()
    expect(listener).toHaveBeenCalledTimes(2)
    undeclare()
    expect(registry.getContent("revenue")).toBe("Revenue")
  })

  it("lets a retiring declaration lose, without counting as a duplicate", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const registry = createSlotRegistry()
    const listener = vi.fn()
    registry.subscribe("revenue", listener)
    const old = {}
    registry.declare(old, "dashboard", { revenue: "Old" })

    registry.retire(old)
    expect(registry.getContent("revenue")).toBe("Old")
    registry.declare({}, "dashboard", { revenue: "New" })
    expect(registry.getContent("revenue")).toBe("New")
    expect(warn).not.toHaveBeenCalled()

    registry.declare(old, "dashboard", { revenue: "Old" })
    expect(registry.getContent("revenue")).toBe("Old")
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it("warns once about slot ids that aren't kebab-case", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const registry = createSlotRegistry()

    registry.declare({}, "dashboard", { "2024": "Year", Revenue: "Revenue" })()
    registry.declare({}, "dashboard", { "2024": "Year", Revenue: "Revenue" })()

    expect(warn.mock.calls).toEqual([
      [
        'Pliant: region "dashboard" has a slot "2024". Slot ids must be kebab-case and start with a letter: keys that look like numbers change the base order.',
      ],
      [
        'Pliant: region "dashboard" has a slot "Revenue". Slot ids must be kebab-case and start with a letter: keys that look like numbers change the base order.',
      ],
    ])
  })

  it("warns about region and slot ids two mounted regions use", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const registry = createSlotRegistry()

    registry.declare({}, "dashboard", { revenue: "Revenue" })
    registry.declare({}, "dashboard", { orders: "Orders" })
    registry.declare({}, "sidebar", { revenue: "Revenue" })

    expect(warn.mock.calls).toEqual([
      [
        'Pliant: two mounted regions use the id "dashboard". Region ids must be unique within a surface.',
      ],
      [
        'Pliant: regions "dashboard" and "sidebar" both declare a slot "revenue". Slot ids must be unique within a surface.',
      ],
    ])
  })

  it("warns once per duplicate slot id", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const registry = createSlotRegistry()

    registry.declare({}, "dashboard", { revenue: "Revenue" })
    registry.declare({}, "sidebar", { revenue: "Revenue" })
    registry.declare({}, "footer", { revenue: "Revenue" })

    expect(warn).toHaveBeenCalledOnce()
  })

  it("doesn't warn when a region declares again after undeclaring", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const registry = createSlotRegistry()

    registry.declare({}, "dashboard", { revenue: "Revenue" })()
    registry.declare({}, "dashboard", { revenue: "Revenue" })

    expect(warn).not.toHaveBeenCalled()
  })
})
