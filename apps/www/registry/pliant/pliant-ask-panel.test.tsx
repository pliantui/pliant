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
  usePliantStore,
  type PliantStore,
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
  save: () => undefined,
}

let store: PliantStore | undefined

function Store() {
  const actions = usePliantStore()
  React.useLayoutEffect(() => {
    store = actions
  }, [actions])
  return null
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
      <Store />
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
  return view
}

async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
}

type PanelProps = React.ComponentProps<typeof PliantAskPanel>

function pendingAnswer() {
  let signal: AbortSignal | null | undefined
  let resolveResponse: (response: Response) => void = () => undefined
  fetchMock.mockImplementationOnce((_input, init) => {
    signal = init?.signal
    return new Promise((resolve) => {
      resolveResponse = resolve
    })
  })
  return {
    signal: () => signal,
    respond: (body: unknown) => {
      resolveResponse(Response.json(body))
    },
  }
}

function Committed({
  value,
  onCommit,
}: {
  value: unknown
  onCommit: () => void
}) {
  React.useLayoutEffect(onCommit, [value, onCommit])
  return null
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

function status() {
  return screen.getByRole("status").textContent
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
  store = undefined
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe("PliantAskPanel", () => {
  it("labels its controls and focuses the prompt when opened", async () => {
    await renderPanel({ defaultOpen: false })
    const trigger = screen.getByRole("button", { name: "Ask" })
    expect(trigger.getAttribute("type")).toBe("button")

    fireEvent.click(trigger)
    await settle()

    expect(screen.getByRole("complementary", { name: "Ask" })).toBeTruthy()
    expect(screen.getByRole("combobox", { name: "Change" }).textContent).toBe(
      "Key metrics"
    )
    expect(document.activeElement).toBe(prompt())
    expect(prompt().getAttribute("maxlength")).toBe("500")
    expect(prompt().getAttribute("placeholder")).toBe("Describe a change")
  })

  it("doesn't take focus when it starts open", async () => {
    await renderPanel()

    expect(screen.getByRole("complementary", { name: "Ask" })).toBeTruthy()
    expect(document.activeElement).toBe(document.body)
  })

  it("only sends contexts the server accepts", () => {
    expectTypeOf<PliantAskContext>().toExtend<AskContext>()
    expectTypeOf<keyof PliantAskContext["manifest"]["capabilities"]>().toExtend<
      keyof AskContext["manifest"]["capabilities"]
    >()
  })

  it("falls back to the first target when the default isn't one", async () => {
    await renderPanel({ defaultTarget: "missing" })
    answer({ status: "clarify", question: "Which card?" })

    await ask("reorder")

    expect(screen.getByRole("combobox", { name: "Change" }).textContent).toBe(
      "Key metrics"
    )
    expect(requestBody()).toMatchObject({ target: "key-metrics" })
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

  it("says so when the page hasn't loaded its layers yet", async () => {
    await renderPanel(
      {},
      { load: () => new Promise(() => undefined), save: () => undefined }
    )

    await ask()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(status()).toBe("The page is still loading. Try again in a moment.")
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
    expect(status()).toContain("Moved the Overdue card to the first position.")
    expect(screen.getByRole("button", { name: "Lock in" })).toBeTruthy()
  })

  it("scrolls the target into view when a preview shows, keeping focus", async () => {
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView")
    await renderPanel()
    answer(okAnswer)
    prompt().focus()

    await ask()

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(
      document.querySelector('[data-pliant-id="key-metrics"]')
    )
    expect(scrollIntoView.mock.calls[0]?.[0]).toMatchObject({
      block: "start",
    })
    expect(document.activeElement).toBe(prompt())
    scrollIntoView.mockRestore()
  })

  it("doesn't scroll when there's nothing to preview", async () => {
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView")
    await renderPanel()
    answer({ status: "clarify", question: "Which card?" })

    await ask()

    expect(scrollIntoView).not.toHaveBeenCalled()
    scrollIntoView.mockRestore()
  })

  it("sends the ask about the default target", async () => {
    await renderPanel({ defaultTarget: "orders-table" })
    answer({ status: "clarify", question: "Which column?" })

    await ask("make it nicer")

    expect(requestBody()).toMatchObject({ target: "orders-table" })
  })

  it("locks in the preview", async () => {
    await renderPanel()
    answer(okAnswer)
    await ask()

    fireEvent.click(screen.getByRole("button", { name: "Lock in" }))

    expect(order()).toEqual(["overdue", "revenue", "orders"])
    expect(status()).toBe("Locked in.")
    expect(screen.queryByRole("button", { name: "Lock in" })).toBeNull()
    expect(document.activeElement).toBe(prompt())
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

    expect(status()).toBe("Locked in.1 change stays for this session only.")
  })

  it("discards the preview", async () => {
    await renderPanel()
    answer(okAnswer)
    await ask()

    fireEvent.click(screen.getByRole("button", { name: "Discard" }))

    expect(order()).toEqual(["revenue", "orders", "overdue"])
    expect(status()).toBe("Discarded.")
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull()
  })

  it("shows a preview that is already active", async () => {
    await renderPanel({ defaultOpen: false })
    act(() => {
      expect(store?.preview(okAnswer.overlay).success).toBe(true)
    })

    fireEvent.click(
      screen.getByRole("button", { name: "Ask (preview active)" })
    )
    await settle()

    expect(status()).toContain("Moved the Overdue card to the first position.")
    expect(screen.getByRole("button", { name: "Lock in" })).toBeTruthy()
  })

  it("shows a clarifying question", async () => {
    await renderPanel()
    answer({ status: "clarify", question: "Which card should go first?" })

    await ask("reorder the cards")

    expect(status()).toBe("Which card should go first?")
    expect(order()).toEqual(["revenue", "orders", "overdue"])
  })

  it("shows an unavailable answer in muted text", async () => {
    await renderPanel()
    answer({ status: "unavailable", reason: "No tool can do that." })

    await ask()

    expect(screen.getByText("No tool can do that.").className).toContain(
      "text-muted-foreground"
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

    expect(status()).toBe(message)
  })

  it("shows an answer that can't be previewed", async () => {
    await renderPanel()
    answer({ status: "ok", overlay: { v: 1 }, explain: ["Nothing."] })

    await ask()

    expect(status()).toMatch(/^The answer couldn't be previewed: /)
    expect(screen.queryByRole("button", { name: "Lock in" })).toBeNull()
  })

  it("shows a network error", async () => {
    await renderPanel()
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))

    await ask()

    expect(status()).toBe("Couldn't reach the server. Check your connection.")
  })

  it("shows the loading state and sends one ask at a time", async () => {
    await renderPanel()
    fetchMock.mockReturnValueOnce(new Promise(() => undefined))

    await ask()
    fireEvent.keyDown(prompt(), { key: "Enter" })
    fireEvent.submit(prompt().closest("form") ?? prompt())
    await settle()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(status()).toBe("Asking…")
    expect(
      screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")
    ).toBe(true)
  })

  it("cancels the ask", async () => {
    await renderPanel()
    let signal: AbortSignal | null | undefined
    fetchMock.mockImplementationOnce((_input, init) => {
      signal = init?.signal
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"))
        })
      })
    })
    await ask()

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    await settle()

    expect(signal?.aborted).toBe(true)
    expect(status()).toBe("Cancelled.")
    expect(document.activeElement).toBe(prompt())
  })

  it("aborts the ask when it unmounts", async () => {
    const { unmount } = await renderPanel()
    let signal: AbortSignal | null | undefined
    fetchMock.mockImplementationOnce((_input, init) => {
      signal = init?.signal
      return new Promise(() => undefined)
    })
    await ask()

    unmount()

    expect(signal?.aborted).toBe(true)
  })

  it("adds a new line with Shift+Enter instead of sending", async () => {
    await renderPanel()
    fireEvent.change(prompt(), { target: { value: "hide the notes" } })

    fireEvent.keyDown(prompt(), { key: "Enter", shiftKey: true })
    await settle()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("doesn't send an empty ask", async () => {
    await renderPanel()

    await ask("   ")

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("doesn't send while an IME is composing", async () => {
    await renderPanel()
    fireEvent.change(prompt(), { target: { value: "ちゅうもん" } })

    fireEvent.keyDown(prompt(), { key: "Enter", keyCode: 229 })
    fireEvent.keyDown(prompt(), { key: "Enter", isComposing: true })
    await settle()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("opens and closes from its trigger", async () => {
    await renderPanel({ defaultOpen: false })
    const trigger = screen.getByRole("button", { name: "Ask" })
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByRole("complementary")).toBeNull()

    fireEvent.click(trigger)
    await settle()

    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(trigger.getAttribute("aria-controls")).toBe(
      screen.getByRole("complementary", { name: "Ask" }).id
    )
    expect(document.activeElement).toBe(prompt())

    fireEvent.click(screen.getByRole("button", { name: "Close" }))

    expect(screen.queryByRole("complementary")).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it("closes with Escape only while focus is inside it", async () => {
    await renderPanel({ defaultOpen: false })
    const trigger = screen.getByRole("button", { name: "Ask" })
    fireEvent.click(trigger)
    await settle()

    fireEvent.keyDown(document.body, { key: "Escape" })
    expect(screen.getByRole("complementary", { name: "Ask" })).toBeTruthy()

    fireEvent.keyDown(prompt(), { key: "Escape" })

    expect(screen.queryByRole("complementary")).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it("doesn't close on Escape while an IME is composing", async () => {
    await renderPanel()

    fireEvent.keyDown(prompt(), { key: "Escape", isComposing: true })

    expect(screen.getByRole("complementary", { name: "Ask" })).toBeTruthy()
  })

  it("cancels the ask when it closes", async () => {
    await renderPanel()
    let signal: AbortSignal | null | undefined
    fetchMock.mockImplementationOnce((_input, init) => {
      signal = init?.signal
      return new Promise(() => undefined)
    })
    await ask()

    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    fireEvent.click(screen.getByRole("button", { name: "Ask" }))
    await settle()

    expect(signal?.aborted).toBe(true)
    expect(status()).toBe("Cancelled.")
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy()
  })

  it("cancels the ask when its parent closes it", async () => {
    const { rerender } = await renderPanel({ open: true })
    let signal: AbortSignal | null | undefined
    fetchMock.mockImplementationOnce((_input, init) => {
      signal = init?.signal
      return new Promise(() => undefined)
    })
    await ask()

    rerender(page({ open: false }))
    expect(signal?.aborted).toBe(true)

    rerender(page({ open: true }))
    await settle()
    expect(status()).toBe("Cancelled.")
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
  })

  it("keeps the page outside it usable", async () => {
    await renderPanel()

    expect(document.querySelector("[aria-modal]")).toBeNull()
    expect(document.querySelector("[data-radix-focus-guard]")).toBeNull()
    expect(screen.getByText("Revenue").closest("[aria-hidden]")).toBeNull()
  })

  it("focuses the prompt when its parent opens it", async () => {
    const { rerender } = await renderPanel({ open: false })
    expect(screen.queryByRole("complementary")).toBeNull()

    rerender(page({ open: true }))
    await settle()

    expect(document.activeElement).toBe(prompt())
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

  it("asks about the target its parent sets", async () => {
    answer({ status: "clarify", question: "Which column?" })
    await renderPanel({ target: "orders-table" })

    expect(screen.getByRole("combobox", { name: "Change" }).textContent).toBe(
      "Orders table"
    )
    await ask("make it nicer")

    expect(requestBody()).toMatchObject({ target: "orders-table" })
  })

  it("falls back to the first target when its parent sets an unknown one", async () => {
    await renderPanel({ target: "missing" })

    expect(screen.getByRole("combobox", { name: "Change" }).textContent).toBe(
      "Key metrics"
    )
  })

  it("focuses the prompt and clears the answer when its parent changes the target", async () => {
    answer({ status: "clarify", question: "Which card?" })
    const { rerender } = await renderPanel({ target: "key-metrics" })
    await ask("reorder")
    expect(status()).toBe("Which card?")
    screen.getByRole("button", { name: "Close" }).focus()

    rerender(page({ target: "orders-table" }))
    await settle()

    expect(screen.getByRole("combobox", { name: "Change" }).textContent).toBe(
      "Orders table"
    )
    expect(status()).toBe("")
    expect(document.activeElement).toBe(prompt())
    expect(prompt()).toHaveProperty("value", "reorder")
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

  it("cancels an ask when its parent changes the target", async () => {
    const { rerender } = await renderPanel({ target: "key-metrics" })
    const pending = pendingAnswer()
    await ask()

    rerender(page({ target: "orders-table" }))
    await settle()

    expect(pending.signal()?.aborted).toBe(true)
    expect(status()).toBe("Cancelled.")
    pending.respond(okAnswer)
    await settle()
    expect(order()).toEqual(["revenue", "orders", "overdue"])
    expect(status()).toBe("Cancelled.")
  })

  it("cancels an ask when its targets drop the current one", async () => {
    const { rerender } = await renderPanel()
    const pending = pendingAnswer()
    await ask()

    rerender(page({ targets: targets.slice(1) }))
    await settle()

    expect(pending.signal()?.aborted).toBe(true)
    expect(status()).toBe("Cancelled.")
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy()
  })

  it.each([
    ["the target changes", { target: "orders-table" }],
    // A smoke check only: the mounted Select makes React flush passive
    // effects early, so this row would still pass if closing aborted the ask
    // in a passive effect. The target row is the one that guards the gap.
    ["it closes", { open: false }],
  ])(
    "never previews an answer that lands right after %s outside an event",
    async (_, change) => {
      const pending = pendingAnswer()
      let update: (props: Partial<PanelProps>) => void = () => undefined
      function Timed() {
        const [props, setProps] = React.useState<Partial<PanelProps>>({
          target: "key-metrics",
          open: true,
        })
        React.useLayoutEffect(() => {
          update = setProps
        }, [])
        return (
          <>
            {page(props)}
            <Committed
              value={props}
              onCommit={() => {
                if (props.target !== "key-metrics" || props.open === false) {
                  pending.respond(okAnswer)
                }
              }}
            />
          </>
        )
      }
      render(<Timed />)
      await settle()
      await ask()

      Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", false)
      try {
        await new Promise((resolve) => {
          setTimeout(() => {
            update({ target: "key-metrics", open: true, ...change })
            setTimeout(resolve, 50)
          }, 0)
        })
      } finally {
        Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)
      }
      await settle()
      expect(pending.signal()?.aborted).toBe(true)
      expect(order()).toEqual(["revenue", "orders", "overdue"])

      act(() => {
        update({ target: "key-metrics", ...change, open: true })
      })
      expect(status()).toBe("Cancelled.")
    }
  )

  it("renders answers as text, never as HTML", async () => {
    await renderPanel()
    answer({ status: "clarify", question: "<img src=x onerror=alert(1)>" })

    await ask()

    expect(status()).toBe("<img src=x onerror=alert(1)>")
    expect(document.querySelector("img")).toBeNull()
  })
})
