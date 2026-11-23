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
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest"

import {
  PliantRoot,
  useMountedNodes,
  type StorageAdapter,
} from "@pliantui/react"
import type { AskContext } from "@pliantui/server"

import {
  PliantAskPanel,
  type PliantAskContext,
  type PliantAskTarget,
} from "./pliant-ask-panel"
import { PliantRegion } from "./pliant-region"

const surface = "/dashboard"

const targets: PliantAskTarget[] = [
  {
    id: "key-metrics",
    label: "Key metrics",
    context: {
      manifest: {
        kind: "region",
        version: 1,
        description: "A row of key metric cards",
        capabilities: { slots: true, hideable: true, layout: true },
      },
      collection: {
        name: "slots",
        items: [
          { id: "revenue", label: "Revenue" },
          { id: "orders", label: "Orders" },
          { id: "overdue", label: "Overdue" },
        ],
      },
    },
  },
  {
    id: "orders-table",
    label: "Orders table",
    context: {
      manifest: {
        kind: "data-table",
        version: 1,
        description: "A table of orders",
        capabilities: { data: true },
      },
    },
  },
]

const moveOverdueFirst = {
  op: "move",
  target: "key-metrics/slots/overdue",
  to: { index: 0 },
}

function overlay(ops: readonly unknown[], explain: readonly string[]) {
  return {
    v: 1,
    id: "01KAB0000000000000000000S1",
    surface,
    layer: "session",
    ops,
    basis: { contract: 1, core: "0.0.0", manifests: { region: 1 } },
    source: "ai",
    explain,
    createdBy: "anonymous",
    createdAt: "2026-11-19T00:00:00.000Z",
  }
}

const okAnswer = {
  status: "ok",
  overlay: overlay(
    [moveOverdueFirst],
    ["Moved the Overdue card to the first position."]
  ),
  explain: ["Moved the Overdue card to the first position."],
}

const storage: StorageAdapter = {
  load: () => ({ personal: [] }),
  save: (_surface, overlay) => ({
    overlay,
    etag: crypto.randomUUID(),
    version: 1,
    updatedAt: new Date().toISOString(),
  }),
}

const tableIds = ["orders-table"]

function Table() {
  useMountedNodes(tableIds)
  return null
}

const fetchMock = vi.fn<typeof fetch>()

function answer(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(Response.json(body, { status }))
}

function page(
  props: Partial<React.ComponentProps<typeof PliantAskPanel>> = {},
  layers: StorageAdapter = storage
) {
  return (
    <PliantRoot surface={surface} storage={layers}>
      <Table />
      <PliantRegion
        id="key-metrics"
        slots={{
          revenue: <p>Revenue</p>,
          orders: <p>Orders</p>,
          overdue: <p>Overdue</p>,
        }}
      />
      <PliantAskPanel
        endpoint="/api/pliant"
        targets={targets}
        defaultOpen
        {...props}
      />
    </PliantRoot>
  )
}

async function renderPanel(
  props: Partial<React.ComponentProps<typeof PliantAskPanel>> = {},
  layers: StorageAdapter = storage
) {
  const view = render(page(props, layers))
  await settle()
  if (props.defaultOpen !== false) {
    await screen.findByRole("textbox", { name: "Ask" })
  }
  return view
}

async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
}

function prompt() {
  return screen.getByRole("textbox", { name: "Ask" })
}

async function ask(text = "put the overdue card first") {
  fireEvent.change(prompt(), { target: { value: text } })
  fireEvent.keyDown(prompt(), { key: "Enter" })
  await settle()
}

function order() {
  const region = document.querySelector('[data-pliant-id="key-metrics"]')
  return [...(region?.children ?? [])].map((child) =>
    child.getAttribute("data-pliant-id")
  )
}

function log() {
  return screen.getByRole("log", { name: "Conversation" })
}

function status() {
  return log().textContent
}

function requestBody(call = 0) {
  const body = fetchMock.mock.calls[call]?.[1]?.body
  return typeof body === "string" ? (JSON.parse(body) as unknown) : undefined
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  cleanup()
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe("PliantAskPanel", () => {
  it("labels its controls and focuses the prompt when opened", async () => {
    await renderPanel({ defaultOpen: false })
    const trigger = screen.getByRole("button", { name: "Ask" })
    expect(trigger.getAttribute("type")).toBe("button")

    fireEvent.click(trigger)
    await screen.findByRole("textbox", { name: "Ask" })

    expect(screen.getByRole("complementary", { name: "Ask" })).toBeTruthy()
    expect(screen.getByRole("combobox", { name: "Change" }).textContent).toBe(
      "Key metrics"
    )
    expect(document.activeElement).toBe(prompt())
    expect(prompt().getAttribute("maxlength")).toBe("500")
    expect(prompt().getAttribute("placeholder")).toBe("Describe a change")
  })

  it("only sends contexts the server accepts", () => {
    expectTypeOf<PliantAskContext>().toExtend<AskContext>()
    expectTypeOf<keyof PliantAskContext["manifest"]["capabilities"]>().toExtend<
      keyof AskContext["manifest"]["capabilities"]
    >()
  })

  it("fills the prompt from a suggestion", async () => {
    await renderPanel({
      targets: targets.map((target) => ({
        ...target,
        suggestions: ["put the overdue card first"],
      })),
    })
    const suggestions = screen.getByRole("group", { name: "Suggestions" })

    fireEvent.click(
      within(suggestions).getByRole("button", {
        name: "put the overdue card first",
      })
    )

    expect(prompt()).toHaveProperty("value", "put the overdue card first")
    expect(document.activeElement).toBe(prompt())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("sends the ask with the root's surface and previews the answer", async () => {
    await renderPanel()
    answer(okAnswer)

    await ask("  put the overdue card first ")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/pliant")
    expect(requestBody()).toEqual({
      surface,
      target: "key-metrics",
      prompt: "put the overdue card first",
      context: targets[0]?.context,
    })
    expect(order()).toEqual(["overdue", "revenue", "orders"])
    expect(status()).toContain("put the overdue card first")
    expect(status()).toContain("Moved the Overdue card to the first position.")
    expect(prompt()).toHaveProperty("value", "")
    const preview = within(log()).getByRole("group", { name: "Preview" })
    expect(
      within(preview).getByRole("button", { name: "Lock in" })
    ).toBeTruthy()
    expect(
      within(preview).getByRole("button", { name: "Discard" })
    ).toBeTruthy()
  })

  it("shows the steps the answer took", async () => {
    await renderPanel()
    answer(okAnswer)

    await ask()

    expect(
      within(log())
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual([
      "Chose an operation: Move",
      "Checked the change against the rules for Key metrics",
    ])
  })

  it("applies nothing until Lock in, and restores the page on Discard", async () => {
    const save = vi.fn<StorageAdapter["save"]>((...args) =>
      storage.save(...args)
    )
    await renderPanel({}, { ...storage, save })
    answer(okAnswer)
    await ask()
    expect(save).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Discard" }))

    expect(order()).toEqual(["revenue", "orders", "overdue"])
    expect(save).not.toHaveBeenCalled()
    expect(status()).toContain("Discarded.")
    expect(screen.queryByRole("button", { name: "Lock in" })).toBeNull()

    answer(okAnswer)
    await ask()
    fireEvent.click(screen.getByRole("button", { name: "Lock in" }))
    await settle()

    expect(save).toHaveBeenCalledTimes(1)
    expect(order()).toEqual(["overdue", "revenue", "orders"])
    expect(status()).toContain("Locked in.")
  })

  it("is a polite log", async () => {
    await renderPanel()

    expect(log().getAttribute("aria-live")).toBe("polite")
  })

  it("starts a new chat and switches back to the last one", async () => {
    await renderPanel()
    answer({ status: "clarify", question: "Which card?" })
    await ask("put the overdue card first")

    fireEvent.click(screen.getByRole("button", { name: "New chat" }))

    expect(status()).not.toContain("Which card?")
    expect(document.activeElement).toBe(prompt())
    answer({ status: "clarify", question: "Which table?" })
    await ask("sort the orders")
    const switcher = screen.getByRole("button", {
      name: "Current chat: sort the orders",
    })
    fireEvent.pointerDown(switcher, { button: 0, ctrlKey: false })
    await settle()
    expect(
      screen.getAllByRole("menuitemradio").map((item) => item.textContent)
    ).toEqual(["sort the orders", "put the overdue card first"])

    fireEvent.click(
      screen.getByRole("menuitemradio", { name: "put the overdue card first" })
    )
    await settle()

    expect(status()).toContain("Which card?")
    expect(status()).not.toContain("Which table?")
  })

  it("shows the open chat again when the panel mounts again", async () => {
    const view = await renderPanel()
    answer({ status: "clarify", question: "Which card?" })
    await ask("put the overdue card first")
    view.unmount()

    await renderPanel()

    expect(status()).toContain("put the overdue card first")
    expect(status()).toContain("Which card?")
    expect(
      screen.getByRole("button", {
        name: "Current chat: put the overdue card first",
      })
    ).toBeTruthy()
  })

  it("sends the ask with a custom fetch in place of the network", async () => {
    const send = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json(okAnswer))
    )
    await renderPanel({ fetch: send })

    await ask()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]?.[0]).toBe("/api/pliant")
    expect(order()).toEqual(["overdue", "revenue", "orders"])
  })

  it("says which changes stay in the session after locking in", async () => {
    await renderPanel()
    answer({
      status: "ok",
      overlay: overlay(
        [moveOverdueFirst, { op: "setPage", target: "orders-table", index: 1 }],
        ["Moved the Overdue card first.", "Went to page 2."]
      ),
      explain: ["Moved the Overdue card first.", "Went to page 2."],
    })
    await ask()

    fireEvent.click(screen.getByRole("button", { name: "Lock in" }))

    expect(status()).toContain(
      "Locked in.1 change stays for this session only."
    )
  })

  it.each([
    [
      {
        status: "unavailable",
        reason: "This panel changes how the page looks, not the data.",
      },
      200,
      "This panel changes how the page looks, not the data.",
    ],
    [
      { status: "error", message: "The model couldn't answer this ask" },
      502,
      "The model couldn't answer this ask",
    ],
    [{ unexpected: true }, 200, "Couldn't read the answer (HTTP 200)."],
  ])("shows a failed answer plainly", async (body, code, message) => {
    await renderPanel()
    answer(body, code)

    await ask()

    expect(status()).toContain(message)
  })

  it("shows a network error", async () => {
    await renderPanel()
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))

    await ask()

    expect(status()).toContain(
      "Couldn't reach the server. Check your connection."
    )
  })

  it("shows the loading state and sends one ask at a time", async () => {
    await renderPanel()
    fetchMock.mockReturnValueOnce(new Promise(() => undefined))

    await ask()
    fireEvent.keyDown(prompt(), { key: "Enter" })
    fireEvent.submit(prompt().closest("form") ?? prompt())
    await settle()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(status()).toContain("Asking…")
    expect(
      screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")
    ).toBe(true)
  })

  it("opens and closes from its trigger", async () => {
    await renderPanel({ defaultOpen: false })
    const trigger = screen.getByRole("button", { name: "Ask" })
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByRole("complementary")).toBeNull()

    fireEvent.click(trigger)
    await screen.findByRole("textbox", { name: "Ask" })

    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(trigger.getAttribute("aria-controls")).toBe(
      screen.getByRole("complementary", { name: "Ask" }).id
    )
    expect(document.activeElement).toBe(prompt())

    fireEvent.click(screen.getByRole("button", { name: "Close" }))

    expect(screen.queryByRole("complementary")).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it("keeps the preview when it closes and marks the trigger", async () => {
    await renderPanel()
    answer(okAnswer)
    await ask()

    fireEvent.click(screen.getByRole("button", { name: "Close" }))

    expect(order()).toEqual(["overdue", "revenue", "orders"])
    const trigger = screen.getByRole("button", {
      name: "Ask (preview active)",
    })
    expect(trigger.hasAttribute("data-preview")).toBe(true)
    expect(trigger.getAttribute("data-state")).toBe("closed")

    fireEvent.click(trigger)
    await settle()

    expect(screen.getByRole("button", { name: "Lock in" })).toBeTruthy()
    expect(status()).toContain("Moved the Overdue card to the first position.")
  })

  it("keeps the page outside it usable", async () => {
    await renderPanel()

    expect(document.querySelector("[aria-modal]")).toBeNull()
    expect(document.querySelector("[data-radix-focus-guard]")).toBeNull()
    expect(screen.getByText("Revenue").closest("[aria-hidden]")).toBeNull()
  })

  it("asks about the target picked in the picker", async () => {
    await renderPanel()
    answer({ status: "clarify", question: "Which column?" })
    const picker = screen.getByRole("combobox", { name: "Change" })

    fireEvent.keyDown(picker, { key: "Enter" })
    await settle()
    fireEvent.click(screen.getByRole("option", { name: "Orders table" }))
    await settle()
    await ask("make it nicer")

    expect(requestBody()).toMatchObject({ target: "orders-table" })
  })

  it("reports picks to its parent without moving focus", async () => {
    const onTargetChange = vi.fn()
    function Controlled() {
      const [target, setTarget] = React.useState("key-metrics")
      return page({
        target,
        onTargetChange: (next) => {
          onTargetChange(next)
          setTarget(next)
        },
      })
    }
    render(<Controlled />)
    await settle()
    const picker = screen.getByRole("combobox", { name: "Change" })

    fireEvent.keyDown(picker, { key: "Enter" })
    await settle()
    fireEvent.click(screen.getByRole("option", { name: "Orders table" }))
    await settle()

    expect(onTargetChange).toHaveBeenCalledWith("orders-table")
    expect(picker.textContent).toBe("Orders table")
    expect(document.activeElement).not.toBe(prompt())
  })

  it("doesn't move focus when its parent applies a pick later", async () => {
    const onTargetChange = vi.fn()
    let applyLater: (target: string) => void = () => undefined
    function Deferred() {
      const [target, setTarget] = React.useState("key-metrics")
      React.useLayoutEffect(() => {
        applyLater = setTarget
      }, [])
      return page({ target, onTargetChange })
    }
    render(<Deferred />)
    await settle()
    const picker = screen.getByRole("combobox", { name: "Change" })

    fireEvent.keyDown(picker, { key: "Enter" })
    await settle()
    fireEvent.click(screen.getByRole("option", { name: "Orders table" }))
    await settle()
    expect(onTargetChange).toHaveBeenCalledWith("orders-table")
    expect(picker.textContent).toBe("Key metrics")
    act(() => {
      applyLater("orders-table")
    })
    await settle()

    expect(picker.textContent).toBe("Orders table")
    expect(document.activeElement).not.toBe(prompt())
  })

  it("focuses the prompt when its parent sets a target it rejected from the picker", async () => {
    const onTargetChange = vi.fn()
    const { rerender } = await renderPanel({
      target: "key-metrics",
      onTargetChange,
    })
    const picker = screen.getByRole("combobox", { name: "Change" })

    fireEvent.keyDown(picker, { key: "Enter" })
    await settle()
    fireEvent.click(screen.getByRole("option", { name: "Orders table" }))
    await settle()
    expect(onTargetChange).toHaveBeenCalledWith("orders-table")
    expect(picker.textContent).toBe("Key metrics")
    screen.getByRole("button", { name: "Close" }).focus()

    rerender(page({ target: "orders-table", onTargetChange }))
    await settle()

    expect(picker.textContent).toBe("Orders table")
    expect(document.activeElement).toBe(prompt())
  })

  it("renders answers as text, never as HTML", async () => {
    await renderPanel()
    answer({ status: "clarify", question: "<img src=x onerror=alert(1)>" })

    await ask()

    expect(status()).toContain("<img src=x onerror=alert(1)>")
    expect(document.querySelector("img")).toBeNull()
  })
})
