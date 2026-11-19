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

import { PliantRoot, type StorageAdapter } from "@pliantui/react"

import { PliantAskPanel, type PliantAskTarget } from "./pliant-ask-panel"
import { PliantPointMode } from "./pliant-point-mode"
import { PliantRegion } from "./pliant-region"

function target(id: string, label: string): PliantAskTarget {
  return {
    id,
    label,
    context: {
      manifest: {
        kind: "region",
        version: 1,
        description: label,
        capabilities: {},
      },
    },
  }
}

const targets = [
  target("orders-table", "Orders table"),
  target("key-metrics", "Key metrics"),
  target("totals", "Totals"),
  target("hidden", "Hidden"),
  target("missing", "Missing"),
]

const storage: StorageAdapter = {
  load: () => ({ personal: [] }),
  save: () => undefined,
}

// happy-dom has no layout, so each element's box comes from `data-top`.
function rectOf(element: Element) {
  const top = element.getAttribute("data-top")
  return top === null
    ? new DOMRect(0, 0, 0, 0)
    : new DOMRect(16, Number(top), 320, 40)
}

function Page({
  onPick = () => undefined,
  children,
}: {
  onPick?: (id: string) => void
  children?: React.ReactNode
}) {
  return (
    <>
      <PliantPointMode targets={targets} onPick={onPick} />
      <input aria-label="Search" />
      <textarea aria-label="Notes" />
      <input type="checkbox" aria-label="Done" />
      <PliantRegion
        id="key-metrics"
        data-top="100"
        slots={{ revenue: <p data-top="100">Revenue</p> }}
      />
      <div data-pliant-id="orders-table" data-top="200" />
      <div data-pliant-id="totals" style={{ display: "contents" }}>
        <p data-top="300" />
        <p data-top="400" />
      </div>
      <div data-pliant-id="hidden" />
      {children}
    </>
  )
}

function renderPage(props: React.ComponentProps<typeof Page> = {}) {
  return render(
    <PliantRoot surface="/dashboard" storage={storage}>
      <Page {...props} />
    </PliantRoot>
  )
}

async function wait(ms = 20) {
  await act(() => new Promise((resolve) => setTimeout(resolve, ms)))
}

function toggle() {
  return screen.getByRole("button", { name: "Point" })
}

function layer() {
  return screen.queryByRole("group", { name: "Parts you can change" })
}

function boxes() {
  const current = layer()
  return current ? within(current).queryAllByRole("button") : []
}

function announcement() {
  return screen.getByRole("status").textContent
}

async function enterWithToggle() {
  fireEvent.click(toggle())
  await wait()
}

async function holdAlt() {
  fireEvent.keyDown(document.body, { key: "Alt", altKey: true })
  await wait(300)
}

beforeEach(() => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return rectOf(this)
    }
  )
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("PliantPointMode", () => {
  it("outlines each target on the page with its label", async () => {
    renderPage()
    expect(toggle().getAttribute("aria-pressed")).toBe("false")
    expect(layer()).toBeNull()

    await enterWithToggle()

    expect(toggle().getAttribute("aria-pressed")).toBe("true")
    expect(toggle().getAttribute("data-state")).toBe("on")
    expect(boxes().map((box) => box.textContent)).toEqual([
      "Key metrics",
      "Orders table",
      "Totals",
    ])
    const [keyMetrics, , totals] = boxes()
    expect(keyMetrics?.style.top).toBe("100px")
    expect(keyMetrics?.style.height).toBe("40px")
    expect(totals?.style.top).toBe("300px")
    expect(totals?.style.height).toBe("140px")
    expect(totals?.style.width).toBe("320px")
    expect(announcement()).toContain("Point mode on.")
  })

  it("moves focus between targets with Tab and the arrow keys", async () => {
    renderPage()
    await enterWithToggle()
    const [first, second, third] = boxes()
    expect(document.activeElement).toBe(first)

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "ArrowDown",
    })
    expect(document.activeElement).toBe(second)
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Tab" })
    expect(document.activeElement).toBe(third)
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Tab" })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Tab",
      shiftKey: true,
    })
    expect(document.activeElement).toBe(third)
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Home",
    })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "ArrowUp",
    })
    expect(document.activeElement).toBe(third)
  })

  it("picks a target and leaves", async () => {
    const onPick = vi.fn()
    renderPage({ onPick })
    await enterWithToggle()

    fireEvent.click(screen.getByRole("button", { name: "Orders table" }))

    expect(onPick).toHaveBeenCalledWith("orders-table")
    expect(layer()).toBeNull()
    expect(toggle().getAttribute("aria-pressed")).toBe("false")
  })

  it("leaves on Escape and returns focus", async () => {
    const onPick = vi.fn()
    renderPage({ onPick })
    toggle().focus()
    await enterWithToggle()

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    })
    await wait()

    expect(layer()).toBeNull()
    expect(document.activeElement).toBe(toggle())
    expect(announcement()).toBe("Point mode off.")
    expect(onPick).not.toHaveBeenCalled()
  })

  it("leaves without picking on a click outside the targets", async () => {
    const onPick = vi.fn()
    renderPage({ onPick })
    await enterWithToggle()

    fireEvent.click(layer() ?? document.body)

    expect(layer()).toBeNull()
    expect(onPick).not.toHaveBeenCalled()
  })

  it("leaves when the toggle is pressed again", async () => {
    renderPage()
    await enterWithToggle()

    fireEvent.click(toggle())

    expect(layer()).toBeNull()
  })

  it.each([{ metaKey: true }, { ctrlKey: true }])(
    "toggles with %o and the period key",
    async (modifier) => {
      renderPage()

      fireEvent.keyDown(document.body, { key: ".", ...modifier })
      await wait()
      expect(layer()).not.toBeNull()
      expect(document.activeElement).toBe(boxes()[0])

      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: ".",
        ...modifier,
      })
      expect(layer()).toBeNull()
    }
  )

  it("lights up while Alt is held", async () => {
    renderPage()

    fireEvent.keyDown(document.body, { key: "Alt", altKey: true })
    await wait(100)
    expect(layer()).toBeNull()
    await wait(250)
    expect(layer()).not.toBeNull()
    expect(boxes()).toHaveLength(3)
    expect(document.activeElement).toBe(document.body)

    const release = new KeyboardEvent("keyup", {
      key: "Alt",
      bubbles: true,
      cancelable: true,
    })
    fireEvent(document.body, release)

    expect(layer()).toBeNull()
    expect(release.defaultPrevented).toBe(true)
  })

  it("picks with a click while Alt is held", async () => {
    const onPick = vi.fn()
    renderPage({ onPick })
    await holdAlt()

    fireEvent.click(screen.getByRole("button", { name: "Key metrics" }))

    expect(onPick).toHaveBeenCalledWith("key-metrics")
    expect(layer()).toBeNull()
  })

  it("leaves Alt alone when it is tapped or used in a shortcut", async () => {
    renderPage()

    fireEvent.keyDown(document.body, { key: "Alt", altKey: true })
    const tap = new KeyboardEvent("keyup", {
      key: "Alt",
      bubbles: true,
      cancelable: true,
    })
    fireEvent(document.body, tap)
    await wait(300)
    expect(layer()).toBeNull()
    expect(tap.defaultPrevented).toBe(false)

    fireEvent.keyDown(document.body, { key: "Alt", altKey: true })
    fireEvent.keyDown(document.body, { key: "ArrowLeft", altKey: true })
    await wait(300)
    expect(layer()).toBeNull()

    fireEvent.keyDown(document.body, { key: "Alt", altKey: true })
    fireEvent.keyDown(document.body, { key: "Dead", altKey: true })
    await wait(300)
    expect(layer()).toBeNull()

    fireEvent.keyDown(document.body, {
      key: "Alt",
      altKey: true,
      ctrlKey: true,
    })
    await wait(300)
    expect(layer()).toBeNull()
  })

  it("leaves when another key is pressed with Alt or the window loses focus", async () => {
    renderPage()
    await holdAlt()

    fireEvent.keyDown(document.body, { key: "Tab", altKey: true })
    expect(layer()).toBeNull()

    await holdAlt()
    expect(layer()).not.toBeNull()
    fireEvent.blur(window)
    expect(layer()).toBeNull()
  })

  it.each(["Search", "Notes"])(
    "ignores Alt and the shortcut in the %s field",
    async (name) => {
      renderPage()
      screen.getByRole("textbox", { name }).focus()

      await holdAlt()
      expect(layer()).toBeNull()

      const shortcut = new KeyboardEvent("keydown", {
        key: ".",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
      fireEvent(document.activeElement ?? document.body, shortcut)
      await wait()
      expect(layer()).toBeNull()
      expect(shortcut.defaultPrevented).toBe(false)
    }
  )

  it("works with Alt while focus is on a checkbox", async () => {
    renderPage()
    screen.getByRole("checkbox", { name: "Done" }).focus()

    await holdAlt()

    expect(layer()).not.toBeNull()
  })

  it("only observes the page while it is on", async () => {
    const observe = vi.spyOn(ResizeObserver.prototype, "observe")
    const disconnect = vi.spyOn(ResizeObserver.prototype, "disconnect")
    renderPage()
    await wait()
    expect(observe).not.toHaveBeenCalled()

    await enterWithToggle()
    expect(observe).toHaveBeenCalled()

    fireEvent.click(toggle())
    await wait()
    expect(disconnect).toHaveBeenCalled()
  })

  it("follows a target that moves", async () => {
    renderPage()
    await enterWithToggle()
    const table = document.querySelector('[data-pliant-id="orders-table"]')

    table?.setAttribute("data-top", "250")
    await wait()

    expect(screen.getByRole("button", { name: "Orders table" }).style.top).toBe(
      "250px"
    )
  })

  it("opens the ask panel on the picked target with focus in the prompt", async () => {
    function Toolbar() {
      const [open, setOpen] = React.useState(false)
      const [picked, setPicked] = React.useState("key-metrics")
      return (
        <>
          <PliantPointMode
            targets={targets}
            onPick={(id) => {
              setPicked(id)
              setOpen(true)
            }}
          />
          <PliantAskPanel
            endpoint="/api/pliant"
            targets={targets}
            target={picked}
            onTargetChange={setPicked}
            open={open}
            onOpenChange={setOpen}
          />
        </>
      )
    }
    render(
      <PliantRoot surface="/dashboard" storage={storage}>
        <Toolbar />
        <div data-pliant-id="orders-table" data-top="200" />
      </PliantRoot>
    )
    await wait()

    fireEvent.keyDown(document.body, { key: ".", ctrlKey: true })
    await wait()
    fireEvent.click(screen.getByRole("button", { name: "Orders table" }))
    await wait()

    const panel = screen.getByRole("complementary", { name: "Ask" })
    expect(
      within(panel).getByRole("combobox", { name: "Change" }).textContent
    ).toBe("Orders table")
    expect(document.activeElement).toBe(
      within(panel).getByRole("textbox", { name: "Ask" })
    )
  })
})
