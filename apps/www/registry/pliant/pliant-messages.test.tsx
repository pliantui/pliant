// @vitest-environment happy-dom
import * as React from "react"
import { createColumnHelper, useTable } from "@tanstack/react-table"
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
import { usePliantTable } from "@pliantui/react/table"

import { PliantAskPanel, type PliantAskTarget } from "./pliant-ask-panel"
import { PliantDataTable } from "./pliant-data-table"
import { PliantDataTableColumnHeader } from "./pliant-data-table-column-header"
import {
  pliantDataTableFeatures,
  type PliantDataTableFeatures,
} from "./pliant-data-table-features"
import { PliantDataTablePagination } from "./pliant-data-table-pagination"
import { PliantDataTableToolbar } from "./pliant-data-table-toolbar"
import { PliantForm } from "./pliant-form"
import { PliantNav, PliantSidebarProvider } from "./pliant-nav"
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
  askChats: "⟦askChats⟧",
  askCurrentChat: "⟦askCurrentChat⟧",
  askNewChat: "⟦askNewChat⟧",
  askNoChats: "⟦askNoChats⟧",
  askDeleteChat: "⟦askDeleteChat⟧",
  askConfirmDelete: "⟦askConfirmDelete⟧",
  askNotSaved: "⟦askNotSaved⟧",
  askConversation: "⟦askConversation⟧",
  askEmptyTitle: "⟦askEmptyTitle⟧",
  askScrollDown: "⟦askScrollDown⟧",
  askSteps: "⟦askSteps⟧",
  askStepChoseOp: (label) => `⟦askStepChoseOp ${label}⟧`,
  askStepChecked: (target) => `⟦askStepChecked ${target}⟧`,
  askOpLabel: (op) => `⟦askOpLabel ${op}⟧`,
  askPreview: "⟦askPreview⟧",
  askPreviewing: "⟦askPreviewing⟧",
  askNotPreviewed: "⟦askNotPreviewed⟧",
  askOtherPreview: "⟦askOtherPreview⟧",
  askGoToChat: "⟦askGoToChat⟧",
  askLockIn: "⟦askLockIn⟧",
  askDiscard: "⟦askDiscard⟧",
  askSuggestions: "⟦askSuggestions⟧",
  askUnreadableAnswer: (status) => `⟦askUnreadableAnswer ${String(status)}⟧`,
  pointModeLabel: "⟦pointModeLabel⟧",
  pointModeHelp: "⟦pointModeHelp⟧",
  pointModeSelected: (label) => `⟦pointModeSelected ${label}⟧`,
  pointModeMove: (label) => `⟦pointModeMove ${label}⟧`,
  pointModeResize: (label) => `⟦pointModeResize ${label}⟧`,
  pointModeHide: (label) => `⟦pointModeHide ${label}⟧`,
  pointModeMoved: (label, position, count) =>
    `⟦pointModeMoved ${label} ${String(position)} ${String(count)}⟧`,
  pointModeResized: (label, columns) =>
    `⟦pointModeResized ${label} ${String(columns)}⟧`,
  pointModeHidden: (label) => `⟦pointModeHidden ${label}⟧`,
  pointModeReset: (label) => `⟦pointModeReset ${label}⟧`,
  pointModeFailed: (label) => `⟦pointModeFailed ${label}⟧`,
  pointModeBar: (label) => `⟦pointModeBar ${label}⟧`,
  pointModeAsk: "⟦pointModeAsk⟧",
  pointModeAdjust: "⟦pointModeAdjust⟧",
  pointModeResetAction: "⟦pointModeResetAction⟧",
  pointModeResetOwner: (label) => `⟦pointModeResetOwner ${label}⟧`,
  formMoreFields: "⟦formMoreFields⟧",
  navMore: "⟦navMore⟧",
  navItemOptions: (title) => `⟦navItemOptions ${title}⟧`,
  navStartPage: "⟦navStartPage⟧",
  regionMore: "⟦regionMore⟧",
  regionNodeUnavailable: (label) => `⟦regionNodeUnavailable ${label}⟧`,
  dataTableNoResults: "⟦dataTableNoResults⟧",
  dataTableTotals: "⟦dataTableTotals⟧",
  dataTableColumns: "⟦dataTableColumns⟧",
  dataTableRows: "⟦dataTableRows⟧",
  dataTableRange: (first, last, total, rows) =>
    `⟦dataTableRange ${first} ${last} ${total} ${rows}⟧`,
  dataTableNoRows: (rows) => `⟦dataTableNoRows ${rows}⟧`,
  dataTablePrevious: "⟦dataTablePrevious⟧",
  dataTableNext: "⟦dataTableNext⟧",
  dataTableRowsPerPage: "⟦dataTableRowsPerPage⟧",
  dataTableSelected: (count) => `⟦dataTableSelected ${count}⟧`,
  dataTableClearFilter: "⟦dataTableClearFilter⟧",
  dataTableFilterPlaceholder: (label) =>
    `⟦dataTableFilterPlaceholder ${label}⟧`,
  dataTableSort: "⟦dataTableSort⟧",
  dataTablePresets: "⟦dataTablePresets⟧",
  customizeOpen: "⟦customizeOpen⟧",
  customizeCustomized: "⟦customizeCustomized⟧",
  customizeAsk: "⟦customizeAsk⟧",
  customizeAdjust: "⟦customizeAdjust⟧",
  customizeHistory: "⟦customizeHistory⟧",
  customizeReset: "⟦customizeReset⟧",
  customizePreviewing: "⟦customizePreviewing⟧",
  navCustomize: "⟦navCustomize⟧",
  dataTableHighlighted: (names) => `⟦dataTableHighlighted ${names.join(" ")}⟧`,
  dataTableHighlightEmphasis: "⟦dataTableHighlightEmphasis⟧",
  dataTableHighlightSuccess: "⟦dataTableHighlightSuccess⟧",
  dataTableHighlightWarning: "⟦dataTableHighlightWarning⟧",
  dataTableHighlightDanger: "⟦dataTableHighlightDanger⟧",
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
      <PliantPointMode
        targets={targets}
        trigger={<button type="button">«Point»</button>}
      />
      <PliantAskPanel
        endpoint="/api/pliant"
        targets={targets}
        trigger={<button type="button">«Ask»</button>}
      />
    </PliantRoot>
  )
}

interface Order {
  id: string
  status: string
  value: number
}

const orders: Order[] = Array.from({ length: 12 }, (_, index) => ({
  id: `«o${String(index + 1)}»`,
  status: index % 2 ? "«open»" : "«paid»",
  value: (index + 1) * 10,
}))

const orderColumns = createColumnHelper<PliantDataTableFeatures, Order>()

const columns = orderColumns.columns([
  orderColumns.accessor("id", {
    meta: { label: "«Order»" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
  }),
  orderColumns.accessor("status", {
    meta: { label: "«Status»" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
  }),
  orderColumns.accessor("value", {
    meta: { label: "«Value»" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
  }),
])

const ordersDataset = {
  fields: {
    id: { type: "id" },
    status: { type: "string" },
    value: { type: "number" },
  },
  timeZone: "UTC",
} as const

function Orders({ data }: { data: Order[] }) {
  useMountedNodes(["orders-table"])
  const options = usePliantTable(
    { features: pliantDataTableFeatures, data, columns },
    { id: "orders-table", dataset: ordersDataset }
  )
  const table = useTable(options)
  const actions = usePliantStore()
  React.useLayoutEffect(() => {
    store = actions
  }, [actions])
  return (
    <>
      <h2 id="orders-title">«Orders»</h2>
      <PliantDataTableToolbar
        table={table}
        node="orders-table"
        filters={[
          { field: "id", control: "search" },
          { field: "value", control: "multi-select", label: "«Amounts»" },
        ]}
        sortOptions={[
          {
            id: "largest",
            label: "«Largest»",
            sort: [{ field: "value", dir: "desc" }],
          },
        ]}
        presets={[
          {
            id: "paid",
            label: "«Paid»",
            filters: [{ field: "status", operator: "eq", value: "«paid»" }],
          },
        ]}
      />
      <PliantDataTable table={table} aria-labelledby="orders-title" />
      <PliantDataTablePagination table={table} rows="«orders»" />
    </>
  )
}

function renderOrders(data: Order[]) {
  return render(
    <PliantRoot surface={surface} storage={storage} messages={messages}>
      <Orders data={data} />
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
  fireEvent.click(screen.getByRole("button", { name: "«Ask»" }))
  await screen.findByRole("textbox", { name: "⟦askPromptLabel⟧" })
}

async function ask() {
  const prompt = screen.getByRole("textbox", { name: "⟦askPromptLabel⟧" })
  fireEvent.change(prompt, { target: { value: "«Move it»" } })
  fireEvent.keyDown(prompt, { key: "Enter" })
  await settle()
}

function chatLog() {
  const panel = screen.getByRole("complementary", { name: "⟦askTitle⟧" })
  return within(panel).getByRole("log").textContent
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
    expect(chatLog()).toContain("⟦askAsking⟧")
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

    expect(chatLog()).toContain(status)
    expect(unmarkedText()).toEqual([])
  })

  it("show only the root's text before the layers load", async () => {
    renderPage({ ...storage, load: () => new Promise(() => undefined) })
    await open()

    await ask()

    expect(chatLog()).toContain("⟦askNotReady⟧")
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
    expect(chatLog()).toContain("⟦askStepChoseOp ⟦askOpLabel move⟧⟧")
    expect(chatLog()).toContain("⟦askPreviewing⟧")
    expect(unmarkedText()).toEqual([])

    fireEvent.click(screen.getByRole("button", { name: "⟦askClose⟧" }))
    expect(
      screen.getByRole("button", { name: "«Ask»" }).hasAttribute("data-preview")
    ).toBe(true)
    expect(unmarkedText()).toEqual([])

    await open()
    fireEvent.click(screen.getByRole("button", { name: "⟦askLockIn⟧" }))
    expect(chatLog()).toContain("⟦askLockedIn⟧⟦askKeptInSession 1⟧")
    expect(unmarkedText()).toEqual([])

    fetchMock.mockResolvedValueOnce(Response.json(answer))
    await ask()
    fireEvent.click(screen.getByRole("button", { name: "⟦askDiscard⟧" }))
    expect(chatLog()).toContain("⟦askDiscarded⟧")
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

    fireEvent.click(screen.getByRole("button", { name: "«Point»" }))
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

  it("show only the root's text and the app's in a form", async () => {
    render(
      <PliantRoot surface={surface} storage={storage} messages={messages}>
        <Page />
        <PliantForm
          id="ticket-form"
          fields={{ subject: <p>«Subject»</p>, cc: <p>«CC»</p> }}
        />
      </PliantRoot>
    )
    await settle()

    apply({
      op: "collapse",
      target: "ticket-form",
      items: ["cc"],
      into: "more",
    })

    expect(
      screen.getByRole("button", { name: "⟦formMoreFields⟧" })
    ).toBeTruthy()
    expect(unmarkedText()).toEqual([])
  })

  it("show only the root's text and the app's in a nav", async () => {
    render(
      <PliantRoot surface={surface} storage={storage} messages={messages}>
        <Page />
        <PliantSidebarProvider id="app-sidebar">
          <PliantNav
            id="app-sidebar"
            items={{
              inbox: { title: "«Inbox»", url: "/inbox" },
              reports: { title: "«Reports»", url: "/reports" },
            }}
          />
        </PliantSidebarProvider>
      </PliantRoot>
    )
    await settle()

    apply({
      op: "collapse",
      target: "app-sidebar",
      items: ["reports"],
      into: "more",
    })
    expect(screen.getByRole("button", { name: "⟦navMore⟧" })).toBeTruthy()
    fireEvent.keyDown(
      screen.getByRole("button", { name: "⟦navItemOptions «Inbox»⟧" }),
      { key: "Enter" }
    )
    await settle()

    expect(
      screen.getByRole("menuitemcheckbox", { name: "⟦navStartPage⟧" })
    ).toBeTruthy()
    expect(screen.getByText("⟦navCustomize⟧")).toBeTruthy()
    expect(unmarkedText()).toEqual([])
  })

  it("show only the root's text and the app's in a data table", async () => {
    renderOrders([])
    expect(screen.getByText("⟦dataTableNoResults⟧")).toBeTruthy()
    expect(screen.getByText(/^⟦dataTableNoRows «orders»⟧/)).toBeTruthy()
    expect(unmarkedText()).toEqual([])

    cleanup()
    renderOrders(orders)
    await settle()
    expect(screen.getByText(/^⟦dataTableRange 1 10 12 «orders»⟧/)).toBeTruthy()
    expect(unmarkedText()).toEqual([])

    fireEvent.click(screen.getByRole("button", { name: "⟦dataTableNext⟧" }))
    expect(screen.getByText(/^⟦dataTableRange 11 12 12 «orders»⟧/)).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "⟦dataTablePrevious⟧" })
    ).toBeTruthy()
    expect(unmarkedText()).toEqual([])
    fireEvent.click(screen.getByRole("button", { name: "⟦dataTablePrevious⟧" }))

    apply(
      ...(["emphasis", "success", "warning", "danger"] as const).map(
        (tone): Op => ({
          op: "addHighlight",
          target: "orders-table",
          id: tone,
          when: { fn: "gt", args: [{ field: "value" }, { value: 0 }] },
          tone,
        })
      )
    )
    expect(
      screen.getAllByText(
        "⟦dataTableHighlighted ⟦dataTableHighlightEmphasis⟧ ⟦dataTableHighlightSuccess⟧ ⟦dataTableHighlightWarning⟧ ⟦dataTableHighlightDanger⟧⟧"
      )
    ).toHaveLength(10)
    expect(unmarkedText()).toEqual([])

    apply(
      { op: "setGroupBy", target: "orders-table", fields: ["status"] },
      {
        op: "addAggregate",
        target: "orders-table",
        id: "total-value",
        label: "«Total value»",
        expr: { fn: "sum", args: [{ field: "value" }] },
      }
    )
    expect(
      screen.getByText(/^⟦dataTableRange 1 2 2 ⟦dataTableRows⟧⟧/)
    ).toBeTruthy()
    const group = screen.getByRole("button", { name: /«open»/ })
    fireEvent.click(group)
    expect(group.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByText("⟦dataTableTotals⟧")).toBeTruthy()
    expect(unmarkedText()).toEqual([])

    fireEvent.keyDown(
      screen.getByRole("button", { name: "⟦dataTableColumns⟧" }),
      {
        key: "Enter",
      }
    )
    await settle(20)
    expect(
      screen.getByRole("menuitemcheckbox", { name: "«Status»" })
    ).toBeTruthy()
    expect(unmarkedText()).toEqual([])
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" })
    await settle(20)

    expect(
      screen
        .getByRole("searchbox", { name: "«Order»" })
        .getAttribute("placeholder")
    ).toBe("⟦dataTableFilterPlaceholder «Order»⟧")
    expect(screen.getByText("⟦dataTableRowsPerPage⟧")).toBeTruthy()
    expect(screen.getByText("⟦customizeCustomized⟧")).toBeTruthy()
    fireEvent.keyDown(screen.getByRole("button", { name: "⟦customizeOpen⟧" }), {
      key: "Enter",
    })
    await settle(20)
    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent)
    ).toEqual([
      "⟦customizeAsk⟧",
      "⟦customizeAdjust⟧",
      "⟦customizeHistory⟧",
      "⟦customizeReset⟧",
    ])
    expect(unmarkedText()).toEqual([])
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" })
    await settle(20)

    fireEvent.keyDown(screen.getByRole("button", { name: "«Amounts»" }), {
      key: "Enter",
    })
    await settle(20)
    for (const item of screen.getAllByRole("menuitemcheckbox").slice(0, 3)) {
      fireEvent.click(item)
    }
    expect(screen.getAllByText("⟦dataTableSelected 3⟧")).not.toHaveLength(0)
    expect(
      screen.getByRole("menuitem", { name: "⟦dataTableClearFilter⟧" })
    ).toBeTruthy()
    expect(unmarkedText()).toEqual([])
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" })
    await settle(20)

    for (const [menu, item] of [
      ["⟦dataTableSort⟧", "«Largest»"],
      ["⟦dataTablePresets⟧", "«Paid»"],
    ] as const) {
      fireEvent.keyDown(screen.getByRole("button", { name: menu }), {
        key: "Enter",
      })
      await settle(20)
      expect(screen.getByRole("menuitemradio", { name: item })).toBeTruthy()
      expect(unmarkedText()).toEqual([])
      fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" })
      await settle(20)
    }
  })
})
