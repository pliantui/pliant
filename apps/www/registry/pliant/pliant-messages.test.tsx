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
  useMountedNodes,
  usePliantStore,
  type PliantMessages,
  type PliantStore,
  type StorageAdapter,
} from "@pliantui/react"

import { PliantAskPanel, type PliantAskTarget } from "./pliant-ask-panel"
import { PliantPointMode } from "./pliant-point-mode"
import { PliantRegion } from "./pliant-region"

// Every entry, so a new one must be added here, and every text marked: what
// the root was given shows in ⟦⟧, the app's own text in «».
const messages: PliantMessages = {
  askNotReady: "⟦askNotReady⟧",
  askUnreachable: "⟦askUnreachable⟧",
  askPreviewFailed: () => "⟦askPreviewFailed⟧",
  askLockInFailed: () => "⟦askLockInFailed⟧",
  pointModeOn: "⟦pointModeOn⟧",
  pointModeOff: "⟦pointModeOff⟧",
  askOpen: "⟦askOpen⟧",
  askPreviewActive: "⟦askPreviewActive⟧",
  askTitle: "⟦askTitle⟧",
  askDescription: "⟦askDescription⟧",
  askClose: "⟦askClose⟧",
  askTargetLabel: "⟦askTargetLabel⟧",
  askPromptLabel: "⟦askPromptLabel⟧",
  askPromptPlaceholder: "⟦askPromptPlaceholder⟧",
  askPromptHint: "⟦askPromptHint⟧",
  askCancel: "⟦askCancel⟧",
  askSend: "⟦askSend⟧",
  askAsking: "⟦askAsking⟧",
  askCancelled: "⟦askCancelled⟧",
  askDiscarded: "⟦askDiscarded⟧",
  askLockedIn: "⟦askLockedIn⟧",
  askKeptInSession: (count) => `⟦askKeptInSession ${String(count)}⟧`,
  askCurrentPreview: "⟦askCurrentPreview⟧",
  askLockIn: "⟦askLockIn⟧",
  askDiscard: "⟦askDiscard⟧",
  askSuggestions: "⟦askSuggestions⟧",
  askUnreadableAnswer: (status) => `⟦askUnreadableAnswer ${String(status)}⟧`,
  pointModeOpen: "⟦pointModeOpen⟧",
  pointModeLabel: "⟦pointModeLabel⟧",
  pointModeHelp: "⟦pointModeHelp⟧",
  regionMore: "⟦regionMore⟧",
  regionNodeUnavailable: (label) => `⟦regionNodeUnavailable ${label}⟧`,
}

const surface = "/dashboard"

const targets: PliantAskTarget[] = [
  {
    id: "key-metrics",
    label: "«Key metrics»",
    suggestions: ["«Put overdue first»"],
    context: {
      manifest: {
        kind: "region",
        version: 1,
        description: "«Key metrics»",
        capabilities: { slots: true, layout: true },
      },
    },
  },
]

function overlay(ops: readonly unknown[]) {
  return {
    v: 1,
    id: "01KAB0000000000000000000S1",
    surface,
    layer: "session",
    ops,
    basis: { contract: 1, core: "0.0.0", manifests: { region: 1 } },
    source: "ai",
    explain: ops.map(() => "«Changed it»"),
    createdBy: "anonymous",
    createdAt: "2026-11-19T00:00:00.000Z",
  }
}

const storage: StorageAdapter = {
  load: () => ({ personal: [] }),
  save: (_surface, saved) => ({
    overlay: saved,
    etag: crypto.randomUUID(),
    version: 1,
    updatedAt: new Date().toISOString(),
  }),
}

const tableIds = ["orders-table"]

let store: PliantStore | undefined

type Op = Parameters<PliantStore["applyOps"]>[1][number]

function Page() {
  useMountedNodes(tableIds)
  const actions = usePliantStore()
  React.useLayoutEffect(() => {
    store = actions
  }, [actions])
  return null
}

function renderPage(layers: StorageAdapter = storage) {
  return render(
    <PliantRoot surface={surface} storage={layers} messages={messages}>
      <Page />
      <PliantRegion
        id="key-metrics"
        slots={{
          revenue: <p>«Revenue»</p>,
          orders: <p>«Orders»</p>,
        }}
      />
      <PliantPointMode targets={targets} onPick={() => undefined} />
      <PliantAskPanel endpoint="/api/pliant" targets={targets} />
    </PliantRoot>
  )
}

const textAttributes = [
  "alt",
  "aria-description",
  "aria-label",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "placeholder",
  "title",
]

/** The text on the page, and in its text attributes, that isn't marked. */
function unmarkedText() {
  const texts: string[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    texts.push(node.textContent ?? "")
  }
  for (const element of document.body.querySelectorAll("*")) {
    for (const name of textAttributes) {
      texts.push(element.getAttribute(name) ?? "")
    }
  }
  return texts
    .map((text) => text.replace(/⟦[^⟧]*⟧|«[^»]*»/g, "").trim())
    .filter((text) => /\p{L}/u.test(text))
}

const fetchMock = vi.fn<typeof fetch>()

async function settle(ms = 0) {
  await act(() => new Promise((resolve) => setTimeout(resolve, ms)))
}

async function open() {
  fireEvent.click(screen.getByRole("button", { name: /^⟦askOpen⟧/ }))
  await settle()
}

async function ask() {
  const prompt = screen.getByRole("textbox", { name: "⟦askPromptLabel⟧" })
  fireEvent.change(prompt, { target: { value: "«Move it»" } })
  fireEvent.keyDown(prompt, { key: "Enter" })
  await settle()
}

function askStatus() {
  const panel = screen.getByRole("complementary", { name: "⟦askTitle⟧" })
  return within(panel).getByRole("status").textContent
}

function apply(...ops: Op[]) {
  act(() => {
    expect(store?.applyOps("session", ops).success).toBe(true)
  })
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
  vi.restoreAllMocks()
})

describe("the registry components with every message given", () => {
  it("show only the root's text and the app's while asking", async () => {
    renderPage()
    expect(unmarkedText()).toEqual([])

    await open()
    expect(unmarkedText()).toEqual([])

    fetchMock.mockReturnValueOnce(new Promise(() => undefined))
    await ask()
    expect(askStatus()).toBe("⟦askAsking⟧")
    expect(unmarkedText()).toEqual([])

    fireEvent.click(screen.getByRole("button", { name: "⟦askCancel⟧" }))
    expect(unmarkedText()).toEqual([])
  })

  it.each<[string, () => void, string]>([
    [
      "a question back",
      () =>
        fetchMock.mockResolvedValueOnce(
          Response.json({ status: "clarify", question: "«Which table?»" })
        ),
      "«Which table?»",
    ],
    [
      "an unavailable change",
      () =>
        fetchMock.mockResolvedValueOnce(
          Response.json({ status: "unavailable", reason: "«Not possible»" })
        ),
      "«Not possible»",
    ],
    [
      "an unreadable answer",
      () => fetchMock.mockResolvedValueOnce(Response.json({}, { status: 500 })),
      "⟦askUnreadableAnswer 500⟧",
    ],
    [
      "a failed request",
      () => fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch")),
      "⟦askUnreachable⟧",
    ],
    [
      "an answer that can't be previewed",
      () =>
        fetchMock.mockResolvedValueOnce(
          Response.json({ status: "ok", overlay: { v: 1 } })
        ),
      "⟦askPreviewFailed⟧",
    ],
  ])("show only the root's text for %s", async (_name, respond, status) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    renderPage()
    await open()

    respond()
    await ask()

    expect(askStatus()).toBe(status)
    expect(unmarkedText()).toEqual([])
  })

  it("show only the root's text before the layers load", async () => {
    renderPage({ ...storage, load: () => new Promise(() => undefined) })
    await open()

    await ask()

    expect(askStatus()).toBe("⟦askNotReady⟧")
    expect(unmarkedText()).toEqual([])
  })

  it("show only the root's text around a preview", async () => {
    renderPage()
    await open()
    const answer = {
      status: "ok",
      overlay: overlay([
        { op: "move", target: "key-metrics/slots/orders", to: { index: 0 } },
        { op: "setPage", target: "orders-table", index: 1 },
      ]),
    }

    fetchMock.mockResolvedValueOnce(Response.json(answer))
    await ask()
    expect(screen.getByText("⟦askCurrentPreview⟧")).toBeTruthy()
    expect(unmarkedText()).toEqual([])

    fireEvent.click(screen.getByRole("button", { name: "⟦askClose⟧" }))
    expect(
      screen.getByRole("button", { name: "⟦askOpen⟧ ⟦askPreviewActive⟧" })
    ).toBeTruthy()
    expect(unmarkedText()).toEqual([])

    await open()
    fireEvent.click(screen.getByRole("button", { name: "⟦askLockIn⟧" }))
    expect(askStatus()).toBe("⟦askLockedIn⟧⟦askKeptInSession 1⟧")
    expect(unmarkedText()).toEqual([])

    fetchMock.mockResolvedValueOnce(Response.json(answer))
    await ask()
    fireEvent.click(screen.getByRole("button", { name: "⟦askDiscard⟧" }))
    expect(askStatus()).toBe("⟦askDiscarded⟧")
    expect(unmarkedText()).toEqual([])
  })

  it("show only the root's text and the app's in point mode", async () => {
    renderPage()

    fireEvent.keyDown(document.body, { key: "Alt", altKey: true })
    await settle(300)
    expect(screen.getByText("⟦pointModeOn⟧")).toBeTruthy()
    expect(unmarkedText()).toEqual([])
    fireEvent.keyUp(document.body, { key: "Alt" })
    expect(screen.getByText("⟦pointModeOff⟧")).toBeTruthy()
    expect(unmarkedText()).toEqual([])

    fireEvent.click(screen.getByRole("button", { name: "⟦pointModeOpen⟧" }))
    await settle(20)
    expect(
      screen.getByRole("dialog", { name: "⟦pointModeLabel⟧" })
    ).toBeTruthy()
    expect(unmarkedText()).toEqual([])
  })

  it("show only the root's text and the app's in a region", async () => {
    renderPage()
    await settle()

    apply(
      {
        op: "collapse",
        target: "key-metrics",
        items: ["orders"],
        into: "more",
      },
      {
        op: "insert",
        target: "key-metrics",
        node: {
          id: "trend",
          kind: "chart",
          dataset: "orders",
          label: "«Trend»",
        },
        at: { index: 0 },
      }
    )

    expect(screen.getByRole("button", { name: "⟦regionMore⟧" })).toBeTruthy()
    expect(screen.getByText("⟦regionNodeUnavailable «Trend»⟧")).toBeTruthy()
    expect(unmarkedText()).toEqual([])
  })
})
