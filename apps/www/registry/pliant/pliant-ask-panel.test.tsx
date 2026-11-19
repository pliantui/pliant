// @vitest-environment happy-dom
import * as React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  PliantRoot,
  useMountedNodes,
  usePliantStore,
  type PliantStore,
  type StorageAdapter,
} from "@pliantui/react"

import { PliantAskPanel, type PliantAskTarget } from "./pliant-ask-panel"
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

async function renderPanel(
  props: Partial<React.ComponentProps<typeof PliantAskPanel>> = {}
) {
  const view = render(
    <PliantRoot surface={surface} storage={storage}>
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
  await settle()
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
  it("labels its controls and focuses the prompt when it opens", async () => {
    await renderPanel()

    expect(screen.getByRole("dialog", { name: "Ask" })).toBeTruthy()
    expect(screen.getByRole("combobox", { name: "Change" }).textContent).toBe(
      "Key metrics"
    )
    expect(document.activeElement).toBe(prompt())
    expect(prompt().getAttribute("maxlength")).toBe("500")
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

    fireEvent.click(screen.getByRole("button", { name: "Ask" }))
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

  it("closes with Escape and returns focus to the trigger", async () => {
    await renderPanel({ defaultOpen: false })
    const trigger = screen.getByRole("button", { name: "Ask" })
    trigger.focus()
    fireEvent.click(trigger)
    await settle()
    expect(document.activeElement).toBe(prompt())

    fireEvent.keyDown(prompt(), { key: "Escape" })
    await settle()

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it("renders answers as text, never as HTML", async () => {
    await renderPanel()
    answer({ status: "clarify", question: "<img src=x onerror=alert(1)>" })

    await ask()

    expect(status()).toBe("<img src=x onerror=alert(1)>")
    expect(document.querySelector("img")).toBeNull()
  })
})
