import { useLayoutEffect } from "react"
import { act, cleanup, render, screen } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { memoryStorage, type StoredInput } from "../test/storage"
import { PliantRoot } from "./pliant-root"
import type { OverlayResult, PliantStore } from "./pliant-store"
import type { StorageAdapter } from "./storage-adapter"
import { usePliantNav, type PliantNav } from "./use-pliant-nav"
import { usePliantNavOpen } from "./use-pliant-nav-open"
import { usePliantStore } from "./use-pliant-store"

const surface = "app-shell"

const items = {
  inbox: { title: "Inbox", url: "/inbox" },
  tickets: { title: "Tickets", url: "/tickets" },
  reports: { title: "Reports", url: "/reports" },
}

function overlay(
  ops: readonly unknown[],
  layer = "personal",
  id = "01KAB0000000000000000000P1"
) {
  return {
    v: 1,
    id,
    surface,
    layer,
    ...(layer === "team" && { scope: { team: "support" } }),
    ops,
    basis: { contract: 1, core: "0.0.0", manifests: {} },
    source: "manual",
    createdBy: "local",
    createdAt: "2026-11-19T00:00:00.000Z",
  }
}

const harness: { store?: PliantStore; nav?: PliantNav } = {}

function Nav() {
  const nav = usePliantNav("app-sidebar", items)
  const store = usePliantStore()
  useLayoutEffect(() => {
    Object.assign(harness, { nav, store })
  })
  return (
    <ul aria-label="nav">
      {nav.entries.map((entry) => (
        <li key={entry.id}>
          {`${entry.id} ${entry.visible ? "visible" : "hidden"}${
            nav.landing === entry.id ? " landing" : ""
          }`}
        </li>
      ))}
    </ul>
  )
}

function Open({ defaultOpen }: { defaultOpen?: boolean | undefined }) {
  const { open, onOpenChange } = usePliantNavOpen("app-sidebar", {
    defaultOpen,
  })
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => {
        onOpenChange(!open)
      }}
    >
      Toggle sidebar
    </button>
  )
}

function App({
  storage,
  defaultOpen,
}: {
  storage: StorageAdapter
  defaultOpen?: boolean | undefined
}) {
  return (
    <PliantRoot surface={surface} storage={storage} teamOrder={["support"]}>
      <Open defaultOpen={defaultOpen} />
      <Nav />
    </PliantRoot>
  )
}

function setup(input: StoredInput = {}, defaultOpen?: boolean) {
  const memory = memoryStorage(input)
  render(<App storage={memory.storage} defaultOpen={defaultOpen} />)
  return memory
}

function shown() {
  return screen.getAllByRole("listitem").map((item) => item.textContent)
}

function toggle() {
  return screen.getByRole("button", { name: "Toggle sidebar" })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  delete harness.store
  delete harness.nav
})

describe("usePliantNav", () => {
  it("renders the items in key order, with no landing, on the server", () => {
    const { storage } = memoryStorage({
      personal: [
        overlay([
          { op: "move", target: "app-sidebar/items/reports", to: { index: 0 } },
          { op: "setLanding", target: "app-sidebar/items/reports" },
        ]),
      ],
    })
    const text = renderToString(<App storage={storage} />).replaceAll(
      /<[^>]+>/g,
      "|"
    )
    expect(text).toContain("inbox visible|")
    expect(text).not.toContain("landing")
    expect(text.indexOf("inbox")).toBeLessThan(text.indexOf("reports"))
  })

  it("orders and hides items, and reads the landing, from the layers", () => {
    setup({
      personal: [
        overlay([
          {
            op: "move",
            target: "app-sidebar/items/reports",
            to: { before: "inbox" },
          },
          { op: "hide", target: "app-sidebar/items/tickets" },
          { op: "setLanding", target: "app-sidebar/items/reports" },
        ]),
      ],
    })
    expect(shown()).toEqual([
      "reports visible landing",
      "inbox visible",
      "tickets hidden",
    ])
  })

  it("drops the landing when its item is hidden", () => {
    setup({
      personal: [
        overlay([{ op: "setLanding", target: "app-sidebar/items/reports" }]),
      ],
    })
    expect(harness.nav?.landing).toBe("reports")
    act(() => {
      harness.store?.applyOps("personal", [
        { op: "hide", target: "app-sidebar/items/reports" },
      ])
    })
    expect(harness.nav?.landing).toBeUndefined()
    expect(shown()).toEqual([
      "inbox visible",
      "tickets visible",
      "reports hidden",
    ])
  })

  it("saves the landing the user sets to their personal layer", () => {
    vi.useFakeTimers()
    const { saved } = setup()
    let result: OverlayResult | undefined
    act(() => {
      result = harness.nav?.setLanding("tickets")
    })
    expect(result?.success).toBe(true)
    expect(shown()[1]).toBe("tickets visible landing")
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(saved.map((each) => each.ops)).toEqual([
      [{ op: "setLanding", target: "app-sidebar/items/tickets" }],
    ])
  })
})

describe("usePliantNavOpen", () => {
  it("is open by default, or as the app's default says", () => {
    setup()
    expect(toggle().getAttribute("aria-expanded")).toBe("true")
    cleanup()
    setup({}, false)
    expect(toggle().getAttribute("aria-expanded")).toBe("false")
  })

  it("saves the user's choice as one personal default, which loads again", () => {
    vi.useFakeTimers()
    const memory = setup()
    act(() => {
      toggle().click()
    })
    expect(toggle().getAttribute("aria-expanded")).toBe("false")
    act(() => {
      vi.advanceTimersByTime(100)
    })
    act(() => {
      toggle().click()
    })
    act(() => {
      toggle().click()
    })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(memory.saved.map((each) => each.ops)).toEqual([
      [
        {
          op: "setDefault",
          target: "app-sidebar",
          prop: "defaultOpen",
          value: false,
        },
      ],
    ])
    cleanup()
    render(<App storage={memory.storage} />)
    expect(toggle().getAttribute("aria-expanded")).toBe("false")
  })

  it("reads a team default below the user's own", () => {
    const team = overlay(
      [
        {
          op: "setDefault",
          target: "app-sidebar",
          prop: "defaultOpen",
          value: false,
        },
      ],
      "team",
      "01KAB0000000000000000000T1"
    )
    setup({ team: [team] })
    expect(toggle().getAttribute("aria-expanded")).toBe("false")
    cleanup()
    setup({
      team: [team],
      personal: [
        overlay([
          {
            op: "setDefault",
            target: "app-sidebar",
            prop: "defaultOpen",
            value: true,
          },
        ]),
      ],
    })
    expect(toggle().getAttribute("aria-expanded")).toBe("true")
  })

  it("ignores a default that isn't a boolean", () => {
    setup(
      {
        personal: [
          overlay([
            {
              op: "setDefault",
              target: "app-sidebar",
              prop: "defaultOpen",
              value: "no",
            },
          ]),
        ],
      },
      true
    )
    expect(toggle().getAttribute("aria-expanded")).toBe("true")
  })

  it("toggles in this tab while the layers load", () => {
    const { storage } = memoryStorage()
    const never: StorageAdapter = {
      ...storage,
      load: () => new Promise(() => undefined),
    }
    render(<App storage={never} />)
    act(() => {
      toggle().click()
    })
    expect(toggle().getAttribute("aria-expanded")).toBe("false")
  })
})
