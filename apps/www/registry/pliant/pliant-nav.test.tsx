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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  PliantRoot,
  usePliantStore,
  type Overlay,
  type PliantStore,
  type StorageAdapter,
} from "@pliantui/react"

import { SidebarTrigger } from "@/components/ui/sidebar"

import { PliantNav, PliantSidebarProvider } from "./pliant-nav"

const surface = "app-shell"

type Op = Parameters<PliantStore["applyOps"]>[1][number]

let store: PliantStore | undefined
let saved: Overlay[] = []

const storage: StorageAdapter = {
  load: () => ({}),
  save: (_surface, overlay) => {
    saved.push(overlay)
    return {
      overlay,
      etag: crypto.randomUUID(),
      version: 1,
      updatedAt: new Date().toISOString(),
    }
  },
}

function Store() {
  const actions = usePliantStore()
  React.useLayoutEffect(() => {
    store = actions
  }, [actions])
  return null
}

function App({ current = "inbox" }: { current?: string }) {
  const link = (id: string, title: string) => ({
    title,
    url: `/${id}`,
    isActive: id === current,
  })
  return (
    <PliantRoot surface={surface} storage={storage}>
      <Store />
      <PliantSidebarProvider id="app-sidebar">
        <SidebarTrigger />
        <nav aria-label="App">
          <PliantNav
            id="app-sidebar"
            items={{
              inbox: link("inbox", "Inbox"),
              tickets: link("tickets", "Tickets"),
              reports: link("reports", "Reports"),
            }}
          />
        </nav>
      </PliantSidebarProvider>
    </PliantRoot>
  )
}

async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
}

async function setup(ops: Op[] = []) {
  render(<App />)
  await settle()
  if (ops.length > 0) {
    act(() => {
      expect(store?.applyOps("personal", ops).success).toBe(true)
    })
  }
}

function links() {
  const nav = screen.getByRole("navigation", { name: "App" })
  return within(nav)
    .getAllByRole("link")
    .map((link) => link.textContent)
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  saved = []
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  store = undefined
})

describe("PliantNav", () => {
  it("renders each item as a link, marking the current page", async () => {
    await setup()
    expect(links()).toEqual(["Inbox", "Tickets", "Reports"])
    expect(
      screen.getByRole("link", { name: "Inbox" }).getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen.getByRole("link", { name: "Tickets" }).getAttribute("href")
    ).toBe("/tickets")
    expect(
      screen.getByRole("link", { name: "Tickets" }).hasAttribute("aria-current")
    ).toBe(false)
  })

  it("renders the items in the user's order, without hidden ones", async () => {
    await setup([
      {
        op: "move",
        target: "app-sidebar/items/reports",
        to: { before: "inbox" },
      },
      { op: "hide", target: "app-sidebar/items/tickets" },
    ])
    expect(links()).toEqual(["Reports", "Inbox"])
  })

  it("collapses items behind a More button that shows them", async () => {
    await setup([
      {
        op: "collapse",
        target: "app-sidebar",
        items: ["tickets", "reports"],
        into: "more",
      },
    ])
    const more = screen.getByRole("button", { name: "More" })
    expect(more.getAttribute("aria-expanded")).toBe("false")
    expect(links()).toEqual(["Inbox"])
    fireEvent.click(more)
    expect(more.getAttribute("aria-expanded")).toBe("true")
    expect(links()).toEqual(["Inbox", "Tickets", "Reports"])
  })

  it("sets the user's start page from an item's options", async () => {
    await setup()
    fireEvent.keyDown(screen.getByRole("button", { name: "Reports options" }), {
      key: "Enter",
    })
    await settle()
    const startPage = screen.getByRole("menuitemcheckbox", {
      name: "Start page",
    })
    expect(startPage.getAttribute("aria-checked")).toBe("false")
    fireEvent.click(startPage)
    await settle()

    fireEvent.keyDown(screen.getByRole("button", { name: "Reports options" }), {
      key: "Enter",
    })
    await settle()
    expect(
      screen
        .getByRole("menuitemcheckbox", { name: "Start page" })
        .getAttribute("aria-checked")
    ).toBe("true")
  })
})

describe("PliantSidebarProvider", () => {
  it("saves the open state the user picks as their own default", async () => {
    await setup()
    const trigger = screen.getByRole("button", { name: "Toggle Sidebar" })
    vi.useFakeTimers()
    fireEvent.click(trigger)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(saved.flatMap((overlay) => overlay.ops)).toEqual([
      {
        op: "setDefault",
        target: "app-sidebar",
        prop: "defaultOpen",
        value: false,
      },
    ])
  })
})
