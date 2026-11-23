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

import {
  PliantPointMode,
  type PliantPointActions,
  type PliantPointFlags,
  type PliantPointModeHandle,
  type PliantPointTarget,
} from "./pliant-point-mode"
import { PliantRegion } from "./pliant-region"

const targets: PliantPointTarget[] = [
  {
    id: "key-metrics",
    label: "Key metrics",
    context: {
      manifest: { capabilities: { slots: true, hideable: true } },
      collection: {
        name: "slots",
        items: [
          { id: "revenue", label: "Revenue" },
          { id: "orders", label: "Orders" },
        ],
      },
    },
  },
  { id: "orders-table", label: "Orders table" },
]

const storage: StorageAdapter = {
  load: () => ({ personal: [] }),
  save: (_surface, overlay) => ({
    overlay,
    etag: crypto.randomUUID(),
    version: 1,
    updatedAt: new Date().toISOString(),
  }),
}

// happy-dom has no layout, so each element's box comes from `data-top`.
function rectOf(element: Element) {
  const top = element.getAttribute("data-top")
  return top === null
    ? new DOMRect(0, 0, 0, 0)
    : new DOMRect(16, Number(top), 320, 40)
}

function Page({
  actions,
  flags,
  handle,
}: {
  actions?: (target: string) => PliantPointActions | undefined
  flags?: PliantPointFlags
  handle?: React.Ref<PliantPointModeHandle>
}) {
  return (
    <>
      <PliantPointMode
        ref={handle}
        targets={targets}
        actions={actions}
        flags={flags}
        trigger={<button type="button">Point</button>}
      />
      <input aria-label="Search" />
      <PliantRegion
        id="key-metrics"
        data-top="100"
        slots={{
          revenue: <p data-top="100">Revenue</p>,
          orders: <p data-top="150">Orders</p>,
        }}
      />
      <div data-pliant-id="orders-table" data-top="300" />
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

function inLayer() {
  const current = layer()
  if (!current) throw new Error("Point mode is off")
  return within(current)
}

function outline(name: string) {
  return inLayer().getByRole("button", { name })
}

function status() {
  return inLayer().getByRole("status").textContent
}

function order() {
  return [
    ...document.querySelectorAll('[data-pliant-id="key-metrics"] > *'),
  ].map((element) => element.getAttribute("data-pliant-id"))
}

function isHidden(element: Element) {
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (getComputedStyle(node).display === "none") return true
  }
  return false
}

async function start() {
  fireEvent.click(toggle())
  await wait()
}

async function select(name: string) {
  fireEvent.click(outline(name))
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
  localStorage.clear()
})

describe("PliantPointMode", () => {
  it("has no button of its own", async () => {
    render(
      <PliantRoot surface="/dashboard" storage={storage}>
        <PliantPointMode targets={targets} />
      </PliantRoot>
    )
    await wait()

    expect(screen.queryByRole("button")).toBeNull()
  })

  it("outlines each target and the slots of a region", async () => {
    renderPage()
    await wait()

    await start()

    expect(
      inLayer()
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Key metrics", "Revenue", "Orders", "Orders table"])
  })

  it("makes the rest of the page inert while on, until Escape", async () => {
    renderPage()
    await start()
    const dialog = screen.getByRole("dialog", { name: "Point mode" })

    expect(
      document.getElementById(dialog.getAttribute("aria-describedby") ?? "")
        ?.textContent
    ).toContain("Delete hides it")
    expect(
      [...document.body.children]
        .filter((element) => element !== dialog)
        .every((element) => element.hasAttribute("inert"))
    ).toBe(true)

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    })
    await wait()

    expect(layer()).toBeNull()
    expect(document.querySelector("[inert]")).toBeNull()
  })

  it("selects a part, announces it and shows its handles and bar", async () => {
    renderPage()
    await start()

    await select("Revenue")

    expect(outline("Revenue").getAttribute("aria-pressed")).toBe("true")
    expect(document.activeElement).toBe(outline("Revenue"))
    expect(status()).toBe("Revenue selected.")
    expect(outline("Move Revenue")).toBeTruthy()
    expect(outline("Hide Revenue")).toBeTruthy()
    // Not a grid, so there's nothing to resize.
    expect(inLayer().queryByRole("button", { name: "Resize Revenue" })).toBe(
      null
    )
    expect(
      inLayer().getByRole("toolbar", { name: "Change Key metrics" })
    ).toBeTruthy()
  })

  it.each([
    ["required", { required: true }, ["Move Revenue"]],
    ["locked", { locked: true }, []],
  ])("shows no handle that a %s flag forbids", async (_, flag, handles) => {
    renderPage({ flags: { "key-metrics/slots/revenue": flag } })
    await start()

    await select("Revenue")

    expect(
      inLayer()
        .queryAllByRole("button", { name: /^(Move|Resize|Hide) / })
        .map((button) => button.getAttribute("aria-label"))
    ).toEqual(handles)
  })

  it("shows no handles on a target that isn't a slot", async () => {
    renderPage()
    await start()

    await select("Key metrics")

    expect(
      inLayer().queryAllByRole("button", { name: /^(Move|Resize|Hide) / })
    ).toEqual([])
  })

  it("moves the selected part with the arrow keys", async () => {
    renderPage()
    await start()
    await select("Revenue")

    fireEvent.keyDown(outline("Revenue"), { key: "ArrowRight" })
    await wait()

    expect(order()).toEqual(["orders", "revenue"])
    expect(status()).toBe("Moved Revenue to position 2 of 2.")
    expect(document.activeElement).toBe(outline("Revenue"))

    fireEvent.keyDown(outline("Revenue"), { key: "ArrowUp" })
    await wait()

    expect(order()).toEqual(["revenue", "orders"])
  })

  it("leaves the arrow keys to moving between outlines without the move handle", async () => {
    renderPage({ flags: { "key-metrics/slots/revenue": { locked: true } } })
    await start()
    await select("Revenue")

    fireEvent.keyDown(outline("Revenue"), { key: "ArrowRight" })
    await wait()

    expect(order()).toEqual(["revenue", "orders"])
  })

  it("hides the selected part with Delete and selects its region", async () => {
    renderPage()
    await start()
    await select("Orders")

    fireEvent.keyDown(outline("Orders"), { key: "Delete" })
    await wait()

    expect(status()).toBe("Hid Orders. Reset brings it back.")
    expect(isHidden(screen.getByText("Orders", { selector: "p" }))).toBe(true)
    expect(outline("Key metrics").getAttribute("aria-pressed")).toBe("true")
  })

  it("doesn't hide a required part with Delete", async () => {
    renderPage({ flags: { "key-metrics/slots/orders": { required: true } } })
    await start()
    await select("Orders")

    fireEvent.keyDown(outline("Orders"), { key: "Delete" })
    await wait()

    expect(isHidden(screen.getByText("Orders", { selector: "p" }))).toBe(false)
  })

  it("runs the bar's actions for the part's region", async () => {
    const onAsk = vi.fn()
    const onReset = vi.fn()
    const actions = vi.fn((): PliantPointActions => ({
      onAsk,
      onReset,
      unavailable: <span>, unavailable</span>,
    }))
    renderPage({ actions })
    await start()
    await select("Revenue")
    const bar = inLayer().getByRole("toolbar", { name: "Change Key metrics" })

    expect(actions).toHaveBeenCalledWith("key-metrics")
    const adjust = within(bar).getByRole("button", { name: /^Adjust/ })
    expect(adjust.textContent).toBe("Adjust, unavailable")
    expect(adjust.hasAttribute("disabled")).toBe(true)

    fireEvent.click(
      within(bar).getByRole("button", { name: "Reset Key metrics" })
    )
    await wait()
    expect(onReset).toHaveBeenCalledOnce()
    expect(status()).toBe("Reset Key metrics.")

    fireEvent.click(within(bar).getByRole("button", { name: "Ask" }))
    await wait()
    expect(layer()).toBeNull()
    expect(onAsk).toHaveBeenCalledOnce()
  })

  it("starts with a target selected from its ref", async () => {
    const handle = React.createRef<PliantPointModeHandle>()
    renderPage({ handle })
    await wait()

    act(() => {
      handle.current?.start("orders-table")
    })
    await wait()

    expect(screen.getByRole("dialog", { name: "Point mode" })).toBeTruthy()
    expect(outline("Orders table").getAttribute("aria-pressed")).toBe("true")
    expect(document.activeElement).toBe(outline("Orders table"))
  })

  it("stays on after Alt is released once a part is selected", async () => {
    renderPage()
    fireEvent.keyDown(document.body, { key: "Alt", altKey: true })
    await wait(300)

    await select("Revenue")
    fireEvent.keyUp(document.body, { key: "Alt" })
    await wait()

    expect(screen.getByRole("dialog", { name: "Point mode" })).toBeTruthy()
    expect(outline("Revenue").getAttribute("aria-pressed")).toBe("true")
  })
})
