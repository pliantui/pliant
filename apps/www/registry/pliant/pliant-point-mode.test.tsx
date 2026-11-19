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
  return (
    screen.queryByRole("dialog", { name: "Point mode" }) ??
    screen.queryByRole("group", { name: "Point mode" })
  )
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
  document.body.replaceChildren()
  document.body.removeAttribute("style")
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
    expect(announcement()).toBe("")
  })

  it("keeps its outlines clickable under a modal layer", async () => {
    renderPage()
    await enterWithToggle()

    expect(layer()?.classList.contains("pointer-events-auto")).toBe(true)
  })

  it("makes the rest of the page inert while on from the toggle", async () => {
    renderPage()
    await enterWithToggle()
    const dialog = screen.getByRole("dialog", { name: "Point mode" })

    expect(dialog.getAttribute("aria-modal")).toBe("true")
    expect(
      document.getElementById(dialog.getAttribute("aria-describedby") ?? "")
        ?.textContent
    ).toContain("Escape to leave")
    const others = [...document.body.children].filter(
      (element) => element !== dialog
    )
    expect(others.length).toBeGreaterThan(0)
    expect(others.every((element) => element.hasAttribute("inert"))).toBe(true)

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    })
    await wait()

    expect(document.querySelector("[inert]")).toBeNull()
  })

  it("keeps labels on screen at the right edge", async () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 400,
    })
    render(
      <>
        <PliantPointMode
          targets={[{ id: "side", label: "Side" }]}
          onPick={() => undefined}
        />
        <div data-pliant-id="side" data-top="100" />
      </>
    )
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        return this.hasAttribute("data-top")
          ? new DOMRect(300, 100, 160, 40)
          : new DOMRect(0, 0, 0, 0)
      }
    )

    await enterWithToggle()

    const label = screen.getByText("Side")
    expect(label.style.right).toBe("60px")
    expect(label.style.left).toBe("")
    Reflect.deleteProperty(document.documentElement, "clientWidth")
  })

  it("starts from the ask panel's prompt", async () => {
    render(
      <PliantRoot surface="/dashboard" storage={storage}>
        <Toolbar />
      </PliantRoot>
    )
    await wait()
    fireEvent.click(screen.getByRole("button", { name: "Ask" }))
    await wait()
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Ask" })
    )

    await holdAlt()

    expect(layer()).not.toBeNull()
  })

  it("opens the ask panel on the picked target with focus in the prompt", async () => {
    render(
      <PliantRoot surface="/dashboard" storage={storage}>
        <Toolbar />
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

  it("returns to the toggle when pointing from it at the panel's own target", async () => {
    render(
      <PliantRoot surface="/dashboard" storage={storage}>
        <Toolbar />
      </PliantRoot>
    )
    await wait()
    fireEvent.click(screen.getByRole("button", { name: "Ask" }))
    await wait()
    toggle().focus()

    fireEvent.click(toggle())
    await wait()
    fireEvent.click(screen.getByRole("button", { name: "Key metrics" }))
    await wait()

    expect(document.activeElement).toBe(toggle())
  })

  it("returns to the prompt when pointing from it at the panel's own target", async () => {
    render(
      <PliantRoot surface="/dashboard" storage={storage}>
        <Toolbar />
      </PliantRoot>
    )
    await wait()
    fireEvent.click(screen.getByRole("button", { name: "Ask" }))
    await wait()
    const prompt = screen.getByRole("textbox", { name: "Ask" })
    expect(document.activeElement).toBe(prompt)

    await holdAlt()
    const box = screen.getByRole("button", { name: "Key metrics" })
    box.focus()
    fireEvent.click(box)
    await wait()

    expect(document.activeElement).toBe(prompt)
  })
})

function Toolbar() {
  const [open, setOpen] = React.useState(false)
  const [target, setTarget] = React.useState("key-metrics")
  return (
    <>
      <PliantPointMode
        targets={targets}
        onPick={(id) => {
          setTarget(id)
          setOpen(true)
        }}
      />
      <PliantAskPanel
        endpoint="/api/pliant"
        targets={targets}
        target={target}
        onTargetChange={setTarget}
        open={open}
        onOpenChange={setOpen}
      />
      <div data-pliant-id="key-metrics" data-top="100" />
      <div data-pliant-id="orders-table" data-top="200" />
    </>
  )
}
