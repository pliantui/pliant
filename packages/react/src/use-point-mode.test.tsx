import type { ComponentProps } from "react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { createPortal } from "react-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { usePointMode } from "./use-point-mode"

const targets = [
  { id: "orders-table", label: "Orders table" },
  { id: "key-metrics", label: "Key metrics" },
  { id: "totals", label: "Totals" },
  { id: "hidden", label: "Hidden" },
  { id: "missing", label: "Missing" },
]

function PointMode({
  targets,
  onPick,
}: {
  targets: readonly { id: string; label: string }[]
  onPick: (id: string) => void
}) {
  const { mode, boxes, announcement, pick, triggerProps, layerProps } =
    usePointMode({ targets, onPick })
  return (
    <>
      <button type="button" {...triggerProps}>
        Point
      </button>
      <span role="status">{announcement}</span>
      {mode !== null &&
        createPortal(
          <div {...layerProps} aria-label="Point mode">
            {boxes.map((box) => (
              <button
                key={box.id}
                type="button"
                style={{
                  top: box.top,
                  left: box.left,
                  width: box.width,
                  height: box.height,
                }}
                onClick={() => {
                  pick(box.id)
                }}
              >
                <span
                  style={
                    box.labelAlign === "end"
                      ? { right: box.labelInset }
                      : { left: box.labelInset }
                  }
                >
                  {box.label}
                </span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}

// happy-dom has no layout, so each element's box comes from `data-top`.
function rectOf(element: Element) {
  const top = element.getAttribute("data-top")
  return top === null
    ? new DOMRect(0, 0, 0, 0)
    : new DOMRect(16, Number(top), 320, 40)
}

function Page({ onPick = () => undefined }: { onPick?: (id: string) => void }) {
  return (
    <>
      <PointMode targets={targets} onPick={onPick} />
      <input aria-label="Search" />
      <textarea aria-label="Notes" />
      <input type="checkbox" aria-label="Done" />
      <div data-pliant-id="key-metrics" data-top="100" />
      <div data-pliant-id="orders-table" data-top="200" />
      <div data-pliant-id="totals" style={{ display: "contents" }}>
        <p data-top="300" />
        <p data-top="400" />
      </div>
      <div data-pliant-id="hidden" />
    </>
  )
}

function renderPage(props: ComponentProps<typeof Page> = {}) {
  return render(<Page {...props} />)
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

async function pressShortcut() {
  const shortcut = new KeyboardEvent("keydown", {
    key: ".",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  })
  fireEvent(document.activeElement ?? document.body, shortcut)
  await wait()
  return shortcut
}

async function releaseAlt() {
  fireEvent.keyUp(document.body, { key: "Alt" })
  await wait()
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

describe("usePointMode", () => {
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
    expect(toggle().getAttribute("aria-pressed")).toBe("false")
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

  it.each([
    ["a listbox", "div", { role: "listbox" }],
    ["a menu", "div", { role: "menu" }],
    ["a modal dialog", "div", { role: "dialog", "aria-modal": "true" }],
    ["an open dialog", "dialog", { open: "" }],
  ])(
    "ignores Alt and the shortcut while focus is in %s",
    async (_, tag, attributes) => {
      const other = document.createElement(tag)
      for (const [name, value] of Object.entries(attributes)) {
        other.setAttribute(name, value)
      }
      const item = document.createElement("button")
      other.append(item)
      document.body.append(other)
      renderPage()
      item.focus()

      await holdAlt()
      expect(layer()).toBeNull()
      await releaseAlt()
      const shortcut = await pressShortcut()
      expect(layer()).toBeNull()
      expect(shortcut.defaultPrevented).toBe(false)

      other.remove()
      await pressShortcut()
      expect(layer()).not.toBeNull()
    }
  )

  it("ignores Alt and the shortcut while a modal dialog is open elsewhere", async () => {
    const modal = document.createElement("div")
    modal.setAttribute("role", "dialog")
    modal.setAttribute("aria-modal", "true")
    document.body.append(modal)
    renderPage()

    await holdAlt()
    expect(layer()).toBeNull()
    await releaseAlt()
    const shortcut = await pressShortcut()
    expect(layer()).toBeNull()
    expect(shortcut.defaultPrevented).toBe(false)

    modal.remove()
    await pressShortcut()
    expect(layer()).not.toBeNull()
  })

  it("ignores Alt and the shortcut while a native modal dialog is open", async () => {
    const dialog = document.createElement("dialog")
    document.body.append(dialog)
    dialog.showModal()
    // happy-dom opens a dialog with `showModal` but doesn't match `:modal`.
    vi.spyOn(dialog, "matches").mockImplementation(
      (selector) => selector === ":modal"
    )
    renderPage()

    await holdAlt()
    expect(layer()).toBeNull()
    await releaseAlt()
    await pressShortcut()
    expect(layer()).toBeNull()

    dialog.remove()
    await pressShortcut()
    expect(layer()).not.toBeNull()
  })

  it("doesn't start when a layer opens while Alt is held", async () => {
    renderPage()

    fireEvent.keyDown(document.body, { key: "Alt", altKey: true })
    await wait(100)
    document.body.style.pointerEvents = "none"
    await wait(250)

    expect(layer()).toBeNull()
    const release = new KeyboardEvent("keyup", {
      key: "Alt",
      bubbles: true,
      cancelable: true,
    })
    fireEvent(document.body, release)
    expect(release.defaultPrevented).toBe(false)
  })

  it("ignores Alt and the shortcut while a modal layer turns off pointer events", async () => {
    renderPage()
    document.body.style.pointerEvents = "none"

    await holdAlt()
    expect(layer()).toBeNull()
    await releaseAlt()
    const shortcut = await pressShortcut()
    expect(layer()).toBeNull()
    expect(shortcut.defaultPrevented).toBe(false)

    document.body.style.pointerEvents = ""
    await holdAlt()
    expect(layer()).not.toBeNull()
  })

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

  it("makes the rest of the page inert while on from the toggle", async () => {
    renderPage()
    await enterWithToggle()
    const dialog = screen.getByRole("dialog", { name: "Point mode" })

    expect(dialog.getAttribute("aria-modal")).toBe("true")
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

  it("leaves the page alone while Alt is held", async () => {
    renderPage()
    await holdAlt()

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(layer()?.hasAttribute("aria-modal")).toBe(false)
    expect(document.querySelector("[inert]")).toBeNull()
  })

  it("keeps an element the app made inert", async () => {
    const outside = document.createElement("div")
    outside.setAttribute("inert", "")
    document.body.append(outside)
    renderPage()
    await enterWithToggle()

    fireEvent.click(layer() ?? document.body)
    await wait()

    expect(outside.hasAttribute("inert")).toBe(true)
    outside.remove()
  })

  it("returns focus after a click outside the targets", async () => {
    renderPage()
    toggle().focus()
    await enterWithToggle()

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    fireEvent.click(layer() ?? document.body)
    await wait()

    expect(document.activeElement).toBe(toggle())
  })

  it("returns focus after a pick unless the app moves it", async () => {
    renderPage()
    toggle().focus()
    await enterWithToggle()

    fireEvent.click(screen.getByRole("button", { name: "Orders table" }))
    await wait()

    expect(document.activeElement).toBe(toggle())
  })

  it("toggles with the Period key on layouts where it needs Shift", async () => {
    renderPage()

    fireEvent.keyDown(document.body, {
      key: ":",
      code: "Period",
      ctrlKey: true,
    })
    await wait()
    expect(layer()).not.toBeNull()

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: ".",
      code: "Semicolon",
      metaKey: true,
      shiftKey: true,
    })
    expect(layer()).toBeNull()
  })

  it("outlines text inside a display: contents target", async () => {
    vi.spyOn(Range.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(16, 500, 80, 20)
    )
    render(
      <PointMode
        targets={[{ id: "note", label: "Note" }]}
        onPick={() => undefined}
      />
    )
    const note = document.createElement("div")
    note.setAttribute("data-pliant-id", "note")
    note.style.display = "contents"
    note.textContent = "Only text"
    document.body.append(note)

    await enterWithToggle()

    expect(screen.getByRole("button", { name: "Note" }).style.top).toBe("500px")
    note.remove()
  })

  it("keeps labels on screen at the right edge", async () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 400,
    })
    render(
      <>
        <PointMode
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

  it("announces the mode only while Alt is held", async () => {
    renderPage()

    await holdAlt()
    expect(announcement()).toBe(
      "Point mode on. Click the part you want to change."
    )
    fireEvent.keyUp(document.body, { key: "Alt" })
    expect(announcement()).toBe("Point mode off.")

    await enterWithToggle()
    expect(announcement()).toBe("")
    fireEvent.click(layer() ?? document.body)
    expect(announcement()).toBe("")
  })

  it("makes nodes added to the page while it is on inert, and only those it made inert", async () => {
    renderPage()
    await enterWithToggle()

    const late = document.createElement("div")
    document.body.append(late)
    await wait()
    expect(late.hasAttribute("inert")).toBe(true)

    fireEvent.click(layer() ?? document.body)
    await wait()
    expect(late.hasAttribute("inert")).toBe(false)
    late.remove()
  })

  it("lets one of two instances take the shortcut", async () => {
    render(
      <>
        <PointMode targets={targets} onPick={() => undefined} />
        <PointMode targets={targets} onPick={() => undefined} />
        <div data-pliant-id="orders-table" data-top="200" />
      </>
    )

    fireEvent.keyDown(document.body, { key: ".", ctrlKey: true })
    await wait()

    const layers = document.querySelectorAll('[data-slot="pliant-point-mode"]')
    expect(layers).toHaveLength(1)
    expect(layers[0]?.hasAttribute("inert")).toBe(false)
    expect(
      screen
        .getAllByRole("button", { name: "Point" })
        .map((button) => button.getAttribute("aria-pressed"))
    ).toEqual(["true", "false"])
  })

  it("doesn't start from Alt in one instance while another is on", async () => {
    render(
      <>
        <PointMode targets={targets} onPick={() => undefined} />
        <PointMode targets={targets} onPick={() => undefined} />
        <div data-pliant-id="orders-table" data-top="200" />
      </>
    )
    const [first] = screen.getAllByRole("button", { name: "Point" })
    if (first) {
      fireEvent.click(first)
    }
    await wait()
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    await holdAlt()

    expect(
      document.querySelectorAll('[data-slot="pliant-point-mode"]')
    ).toHaveLength(1)
    expect(
      screen
        .getAllByRole("button", { name: "Point", hidden: true })
        .map((button) => button.getAttribute("aria-pressed"))
    ).toEqual(["true", "false"])
  })

  it("keeps another instance's layer usable", async () => {
    const other = document.createElement("div")
    other.setAttribute("data-slot", "pliant-point-mode")
    document.body.append(other)
    renderPage()

    await enterWithToggle()

    expect(other.hasAttribute("inert")).toBe(false)
    other.remove()
  })
})
