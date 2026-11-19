import { createRef, useLayoutEffect, useState, type KeyboardEvent } from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PliantRoot } from "./pliant-root"
import type { StorageAdapter } from "./storage-adapter"
import { useAskPanel, type UseAskPanelOptions } from "./use-ask-panel"
import { useMountedNodes } from "./use-mounted-nodes"
import { usePliantStore } from "./use-pliant-store"
import { usePreview } from "./use-preview"

const surface = "/orders"

interface Target {
  id: string
  label: string
}

const targets: Target[] = [
  { id: "orders-table", label: "Orders table" },
  { id: "totals", label: "Totals" },
]

function overlay(ops: readonly unknown[], explain: readonly string[]) {
  return {
    v: 1,
    id: "01KAB0000000000000000000S1",
    surface,
    layer: "session",
    ops,
    basis: { contract: 1, core: "0.0.0", manifests: {} },
    source: "ai",
    explain,
    createdBy: "anonymous",
    createdAt: "2026-11-19T00:00:00.000Z",
  }
}

const widen = {
  op: "setColumnWidth",
  target: "orders-table/columns/total",
  width: 240,
}

const widenOverlay = overlay([widen], ["Made the Total column wider."])

const okAnswer: AskAnswer = { status: "ok", overlay: widenOverlay }

const storage: StorageAdapter = {
  load: () => ({ personal: [] }),
  save: () => undefined,
}

type AskAnswer = Awaited<ReturnType<UseAskPanelOptions<Target>["send"]>>

const send = vi.fn<UseAskPanelOptions<Target>["send"]>()

function answer(value: AskAnswer) {
  send.mockResolvedValueOnce(value)
}

function pendingAnswer() {
  let signal: AbortSignal | undefined
  let resolve: (value: AskAnswer) => void = () => undefined
  send.mockImplementationOnce((_ask, abortSignal) => {
    signal = abortSignal
    return new Promise((settle) => {
      resolve = settle
    })
  })
  return {
    signal: () => signal,
    respond: (value: AskAnswer) => {
      resolve(value)
    },
  }
}

type Panel = ReturnType<typeof useAskPanel<Target>>

type PanelProps = Partial<UseAskPanelOptions<Target>> & {
  promptProps?: Parameters<Panel["getPromptProps"]>[0]
  pickerProps?: Parameters<Panel["getPickerProps"]>[0]
}

function statusText(state: Panel["state"]) {
  switch (state.status) {
    case "asking":
      return "Asking…"
    case "clarify":
      return state.question
    case "failed":
      return state.message
    case "unavailable":
      return state.reason
    case "cancelled":
      return "Cancelled."
    case "discarded":
      return "Discarded."
    case "locked":
      return `Locked in. ${String(state.keptInSession.length)} in session.`
    default:
      return ""
  }
}

function Panel({ promptProps, pickerProps, ...options }: PanelProps) {
  const panel = useAskPanel({ targets, send, ...options })
  const preview = usePreview()
  const asking = panel.state.status === "asking"
  return (
    <>
      <button type="button" {...panel.getTriggerProps()}>
        Ask
      </button>
      {panel.open && (
        <aside {...panel.getPanelProps()} aria-label="Ask">
          <button
            type="button"
            onClick={() => {
              panel.setOpen(false)
            }}
          >
            Close
          </button>
          <select
            {...panel.getPickerProps(pickerProps)}
            aria-label="Change"
            value={panel.target?.id}
            disabled={asking}
            onChange={(event) => {
              panel.setTarget(event.target.value)
            }}
          >
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.label}
              </option>
            ))}
          </select>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              panel.ask()
            }}
          >
            <textarea
              {...panel.getPromptProps(promptProps)}
              aria-label="Prompt"
            />
            {asking && (
              <button type="button" onClick={panel.cancel}>
                Cancel
              </button>
            )}
            <button type="submit" disabled={asking}>
              Send
            </button>
          </form>
          <div role="status">
            {statusText(panel.state)}
            {asking ? "" : [...new Set(preview?.explain)].join(" ")}
          </div>
          {preview !== null && !asking && (
            <>
              <button type="button" onClick={panel.lockIn}>
                Lock in
              </button>
              <button type="button" onClick={panel.discard}>
                Discard
              </button>
            </>
          )}
          <button
            type="button"
            disabled={asking}
            onClick={() => {
              panel.setPrompt("make the total wider")
            }}
          >
            Suggest
          </button>
        </aside>
      )}
    </>
  )
}

const tableIds = ["orders-table"]

function Page() {
  useMountedNodes(tableIds)
  const store = usePliantStore()
  const preview = usePreview()
  return (
    <>
      <div data-pliant-id="orders-table" />
      <p title="Preview">{preview === null ? "none" : "on"}</p>
      <button
        type="button"
        onClick={() => {
          store.preview(widenOverlay)
        }}
      >
        Preview elsewhere
      </button>
    </>
  )
}

function page(props: PanelProps = {}, layers: StorageAdapter = storage) {
  return (
    <PliantRoot surface={surface} storage={layers}>
      <Page />
      <Panel defaultOpen {...props} />
    </PliantRoot>
  )
}

async function renderPanel(
  props: PanelProps = {},
  layers: StorageAdapter = storage
) {
  const view = render(page(props, layers))
  await settle()
  return view
}

async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
}

function prompt() {
  return screen.getByRole("textbox", { name: "Prompt" })
}

function picker(): HTMLSelectElement {
  const element = screen.getByRole("combobox", { name: "Change" })
  if (!(element instanceof HTMLSelectElement)) {
    throw new Error("The picker isn't a select")
  }
  return element
}

function trigger() {
  return screen.getByRole("button", { name: "Ask" })
}

function previewShown() {
  return screen.getByTitle("Preview").textContent === "on"
}

async function ask(text = "make the total wider") {
  fireEvent.change(prompt(), { target: { value: text } })
  fireEvent.keyDown(prompt(), { key: "Enter" })
  await settle()
}

function pick(id: string) {
  fireEvent.focus(picker())
  fireEvent.change(picker(), { target: { value: id } })
}

function status() {
  return screen.getByRole("status").textContent
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  send.mockReset()
  vi.restoreAllMocks()
})

describe("useAskPanel", () => {
  it("opens from its trigger, focuses the prompt and closes back to the trigger", async () => {
    await renderPanel({ defaultOpen: false })
    expect(trigger().getAttribute("aria-expanded")).toBe("false")
    expect(trigger().getAttribute("data-state")).toBe("closed")
    expect(screen.queryByRole("complementary")).toBeNull()

    fireEvent.click(trigger())
    await settle()

    const panel = screen.getByRole("complementary", { name: "Ask" })
    expect(trigger().getAttribute("aria-expanded")).toBe("true")
    expect(trigger().getAttribute("aria-controls")).toBe(panel.id)
    expect(panel.getAttribute("data-slot")).toBe("pliant-ask-panel")
    expect(document.activeElement).toBe(prompt())

    fireEvent.click(screen.getByRole("button", { name: "Close" }))

    expect(screen.queryByRole("complementary")).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it("doesn't take focus when it starts open", async () => {
    await renderPanel()

    expect(screen.getByRole("complementary", { name: "Ask" })).toBeTruthy()
    expect(document.activeElement).toBe(document.body)
  })

  it("sends the ask with the root's surface and previews the answer", async () => {
    await renderPanel()
    answer(okAnswer)

    await ask("  make the total wider ")

    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]?.[0]).toEqual({
      surface,
      target: targets[0],
      prompt: "make the total wider",
    })
    expect(previewShown()).toBe(true)
    expect(status()).toBe("Made the Total column wider.")
    expect(screen.getByRole("button", { name: "Lock in" })).toBeTruthy()
  })

  it("asks about the default target, or the first when it isn't one", async () => {
    answer({ status: "clarify", question: "Which column?" })
    const { unmount } = await renderPanel({ defaultTarget: "totals" })
    await ask()
    expect(send.mock.calls[0]?.[0].target).toBe(targets[1])
    unmount()

    answer({ status: "clarify", question: "Which column?" })
    await renderPanel({ defaultTarget: "missing" })
    expect(picker().value).toBe("orders-table")
    await ask()
    expect(send.mock.calls[1]?.[0].target).toBe(targets[0])
  })

  it("fills the prompt from a suggestion", async () => {
    await renderPanel()

    fireEvent.click(screen.getByRole("button", { name: "Suggest" }))

    expect(prompt()).toHaveProperty("value", "make the total wider")
    expect(document.activeElement).toBe(prompt())
    expect(send).not.toHaveBeenCalled()
  })

  it("says so when the page hasn't loaded its layers yet", async () => {
    await renderPanel(
      {},
      { load: () => new Promise(() => undefined), save: () => undefined }
    )

    await ask()

    expect(send).not.toHaveBeenCalled()
    expect(status()).toBe("The page is still loading. Try again in a moment.")
  })

  it("locks in the preview", async () => {
    await renderPanel()
    answer(okAnswer)
    await ask()

    fireEvent.click(screen.getByRole("button", { name: "Lock in" }))

    expect(previewShown()).toBe(false)
    expect(status()).toBe("Locked in. 0 in session.")
    expect(screen.queryByRole("button", { name: "Lock in" })).toBeNull()
    expect(document.activeElement).toBe(prompt())
  })

  it("says which changes stay in the session after locking in", async () => {
    await renderPanel()
    answer({
      status: "ok",
      overlay: overlay(
        [widen, { op: "setPage", target: "orders-table", index: 1 }],
        ["Made the Total column wider.", "Went to page 2."]
      ),
    })
    await ask()

    fireEvent.click(screen.getByRole("button", { name: "Lock in" }))

    expect(status()).toBe("Locked in. 1 in session.")
  })

  it("discards the preview", async () => {
    await renderPanel()
    answer(okAnswer)
    await ask()

    fireEvent.click(screen.getByRole("button", { name: "Discard" }))

    expect(previewShown()).toBe(false)
    expect(status()).toBe("Discarded.")
    expect(document.activeElement).toBe(prompt())
  })

  it("lists each sentence of the preview once", async () => {
    await renderPanel()
    answer({
      status: "ok",
      overlay: overlay(
        [widen, { ...widen, width: 260 }],
        ["Made it wider.", "Made it wider."]
      ),
    })

    await ask()

    expect(status()).toBe("Made it wider.")
  })

  it.each<[AskAnswer, string]>([
    [{ status: "clarify", question: "Which column?" }, "Which column?"],
    [{ status: "unavailable", reason: "out-of-scope" }, "out-of-scope"],
    [{ status: "error", message: "The model failed." }, "The model failed."],
  ])("shows a %o answer without previewing", async (value, message) => {
    await renderPanel()
    answer(value)

    await ask()

    expect(status()).toBe(message)
    expect(previewShown()).toBe(false)
  })

  it("shows an answer that can't be previewed", async () => {
    await renderPanel()
    answer({ status: "ok", overlay: { v: 1 } })

    await ask()

    expect(status()).toMatch(/^The answer couldn't be previewed: /)
    expect(screen.queryByRole("button", { name: "Lock in" })).toBeNull()
  })

  it("says the server couldn't be reached when sending fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    await renderPanel()
    send.mockRejectedValueOnce(new TypeError("Failed to fetch"))

    await ask()

    expect(status()).toBe("Couldn't reach the server. Check your connection.")
  })

  it("logs why sending failed in development", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    await renderPanel()
    const failure = new TypeError("Failed to fetch")
    send.mockRejectedValueOnce(failure)

    await ask()

    expect(error).toHaveBeenCalledWith(failure)
  })

  it("runs the app's prompt handlers first and composes its ref", async () => {
    const ref = createRef<HTMLTextAreaElement>()
    const onKeyDown = vi.fn((event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.ctrlKey) {
        event.preventDefault()
      }
    })
    await renderPanel({ promptProps: { ref, onKeyDown } })
    answer({ status: "clarify", question: "Which column?" })
    expect(ref.current).toBe(prompt())
    fireEvent.change(prompt(), { target: { value: "make it wider" } })

    fireEvent.keyDown(prompt(), { key: "Enter", ctrlKey: true })
    await settle()
    expect(onKeyDown).toHaveBeenCalledTimes(1)
    expect(send).not.toHaveBeenCalled()

    fireEvent.keyDown(prompt(), { key: "Enter" })
    await settle()
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("keeps forgetting a rejected pick when the app handles the picker's blur", async () => {
    const onBlur = vi.fn()
    const { rerender } = await renderPanel({
      target: "orders-table",
      onTargetChange: () => undefined,
      pickerProps: { onBlur },
    })
    picker().focus()
    pick("totals")
    await settle()
    screen.getByRole("button", { name: "Close" }).focus()

    rerender(
      page({
        target: "totals",
        onTargetChange: () => undefined,
        pickerProps: { onBlur },
      })
    )
    await settle()

    expect(onBlur).toHaveBeenCalled()
    expect(document.activeElement).toBe(prompt())
  })

  it("sends one ask at a time", async () => {
    await renderPanel()
    send.mockReturnValueOnce(new Promise(() => undefined))

    await ask()
    fireEvent.keyDown(prompt(), { key: "Enter" })
    fireEvent.submit(prompt().closest("form") ?? prompt())
    await settle()

    expect(send).toHaveBeenCalledTimes(1)
    expect(status()).toBe("Asking…")
    expect(prompt().hasAttribute("readonly")).toBe(true)
    expect(picker().disabled).toBe(true)
  })

  it("cancels the ask", async () => {
    await renderPanel()
    const pending = pendingAnswer()
    await ask()

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    pending.respond(okAnswer)
    await settle()

    expect(pending.signal()?.aborted).toBe(true)
    expect(status()).toBe("Cancelled.")
    expect(previewShown()).toBe(false)
    expect(document.activeElement).toBe(prompt())
  })

  it("aborts the ask when it unmounts", async () => {
    const { unmount } = await renderPanel()
    const pending = pendingAnswer()
    await ask()

    unmount()

    expect(pending.signal()?.aborted).toBe(true)
  })

  it("adds a new line with Shift+Enter instead of sending", async () => {
    await renderPanel()
    fireEvent.change(prompt(), { target: { value: "hide the notes" } })

    fireEvent.keyDown(prompt(), { key: "Enter", shiftKey: true })
    await settle()

    expect(send).not.toHaveBeenCalled()
  })

  it("doesn't send an empty ask", async () => {
    await renderPanel()

    await ask("   ")

    expect(send).not.toHaveBeenCalled()
  })

  it("doesn't send while an IME is composing", async () => {
    await renderPanel()
    fireEvent.change(prompt(), { target: { value: "ちゅうもん" } })

    fireEvent.keyDown(prompt(), { key: "Enter", keyCode: 229 })
    fireEvent.keyDown(prompt(), { key: "Enter", isComposing: true })
    await settle()

    expect(send).not.toHaveBeenCalled()
  })

  it("closes with Escape only while focus is inside it", async () => {
    await renderPanel({ defaultOpen: false })
    fireEvent.click(trigger())
    await settle()

    fireEvent.keyDown(document.body, { key: "Escape" })
    expect(screen.getByRole("complementary", { name: "Ask" })).toBeTruthy()
    fireEvent.keyDown(prompt(), { key: "Escape", isComposing: true })
    expect(screen.getByRole("complementary", { name: "Ask" })).toBeTruthy()

    fireEvent.keyDown(prompt(), { key: "Escape" })

    expect(screen.queryByRole("complementary")).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it("cancels the ask when it closes", async () => {
    await renderPanel()
    const pending = pendingAnswer()
    await ask()

    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    fireEvent.click(trigger())
    await settle()

    expect(pending.signal()?.aborted).toBe(true)
    expect(status()).toBe("Cancelled.")
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull()
  })

  it("cancels the ask when its parent closes it", async () => {
    const { rerender } = await renderPanel({ open: true })
    const pending = pendingAnswer()
    await ask()

    rerender(page({ open: false }))
    expect(pending.signal()?.aborted).toBe(true)

    rerender(page({ open: true }))
    await settle()
    expect(status()).toBe("Cancelled.")
  })

  it("keeps the preview when it closes and marks the trigger", async () => {
    await renderPanel()
    answer(okAnswer)
    await ask()

    fireEvent.click(screen.getByRole("button", { name: "Close" }))

    expect(previewShown()).toBe(true)
    expect(trigger().hasAttribute("data-preview")).toBe(true)

    fireEvent.click(trigger())
    await settle()

    expect(screen.getByRole("button", { name: "Lock in" })).toBeTruthy()
  })

  it("shows a preview that is already active", async () => {
    await renderPanel({ defaultOpen: false })

    fireEvent.click(screen.getByRole("button", { name: "Preview elsewhere" }))
    expect(trigger().hasAttribute("data-preview")).toBe(true)
    fireEvent.click(trigger())
    await settle()

    expect(status()).toBe("Made the Total column wider.")
    expect(screen.getByRole("button", { name: "Lock in" })).toBeTruthy()
  })

  it("focuses the prompt when its parent opens it", async () => {
    const onOpenChange = vi.fn()
    const { rerender } = await renderPanel({ open: false, onOpenChange })

    fireEvent.click(trigger())
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(screen.queryByRole("complementary")).toBeNull()
    rerender(page({ open: true, onOpenChange }))
    await settle()

    expect(document.activeElement).toBe(prompt())
  })

  it("asks about the target picked in the picker", async () => {
    await renderPanel()
    answer({ status: "clarify", question: "Which total?" })

    pick("totals")
    await ask()

    expect(send.mock.calls[0]?.[0].target).toBe(targets[1])
  })

  it("asks about the target its parent sets, or the first when it isn't one", async () => {
    answer({ status: "clarify", question: "Which total?" })
    const { rerender } = await renderPanel({ target: "totals" })
    expect(picker().value).toBe("totals")
    await ask()
    expect(send.mock.calls[0]?.[0].target).toBe(targets[1])

    rerender(page({ target: "missing" }))
    await settle()

    expect(picker().value).toBe("orders-table")
  })

  it("focuses the prompt and clears the answer when its parent changes the target", async () => {
    answer({ status: "clarify", question: "Which column?" })
    const { rerender } = await renderPanel({ target: "orders-table" })
    await ask("reorder")
    expect(status()).toBe("Which column?")
    screen.getByRole("button", { name: "Close" }).focus()

    rerender(page({ target: "totals" }))
    await settle()

    expect(picker().value).toBe("totals")
    expect(status()).toBe("")
    expect(document.activeElement).toBe(prompt())
    expect(prompt()).toHaveProperty("value", "reorder")
  })

  it("reports picks to its parent without moving focus", async () => {
    const onTargetChange = vi.fn()
    function Controlled() {
      const [target, setTarget] = useState("orders-table")
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
    picker().focus()

    pick("totals")
    await settle()

    expect(onTargetChange).toHaveBeenCalledWith("totals")
    expect(picker().value).toBe("totals")
    expect(document.activeElement).toBe(picker())
  })

  it("doesn't move focus when its parent applies a pick later", async () => {
    const onTargetChange = vi.fn()
    let applyLater: (target: string) => void = () => undefined
    function Deferred() {
      const [target, setTarget] = useState("orders-table")
      useLayoutEffect(() => {
        applyLater = setTarget
      }, [])
      return page({ target, onTargetChange })
    }
    render(<Deferred />)
    await settle()
    picker().focus()

    pick("totals")
    await settle()
    expect(onTargetChange).toHaveBeenCalledWith("totals")
    expect(picker().value).toBe("orders-table")
    act(() => {
      applyLater("totals")
    })
    await settle()

    expect(picker().value).toBe("totals")
    expect(document.activeElement).toBe(picker())
  })

  it("focuses the prompt when its parent sets a target it rejected from the picker", async () => {
    const onTargetChange = vi.fn()
    const { rerender } = await renderPanel({
      target: "orders-table",
      onTargetChange,
    })
    picker().focus()

    pick("totals")
    await settle()
    expect(onTargetChange).toHaveBeenCalledWith("totals")
    screen.getByRole("button", { name: "Close" }).focus()

    rerender(page({ target: "totals", onTargetChange }))
    await settle()

    expect(document.activeElement).toBe(prompt())
  })

  it("cancels an ask when its parent changes the target", async () => {
    const { rerender } = await renderPanel({ target: "orders-table" })
    const pending = pendingAnswer()
    await ask()

    rerender(page({ target: "totals" }))
    await settle()

    expect(pending.signal()?.aborted).toBe(true)
    expect(status()).toBe("Cancelled.")
    pending.respond(okAnswer)
    await settle()
    expect(previewShown()).toBe(false)
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
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull()
  })

  it("never previews an answer that lands right after the target changes outside an event", async () => {
    const pending = pendingAnswer()
    let update: (target: string) => void = () => undefined
    function Timed() {
      const [target, setTarget] = useState("orders-table")
      useLayoutEffect(() => {
        update = setTarget
      }, [])
      useLayoutEffect(() => {
        if (target !== "orders-table") {
          pending.respond(okAnswer)
        }
      }, [target])
      return page({ target })
    }
    render(<Timed />)
    await settle()
    await ask()

    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", false)
    try {
      await new Promise((resolve) => {
        setTimeout(() => {
          update("totals")
          setTimeout(resolve, 50)
        }, 0)
      })
    } finally {
      Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)
    }
    await settle()

    expect(pending.signal()?.aborted).toBe(true)
    expect(previewShown()).toBe(false)
    expect(status()).toBe("Cancelled.")
  })
})

describe("useAskPanel over its target", () => {
  const scrollIntoView = vi.fn<Element["scrollIntoView"]>()

  // Boxes are `[x, y, width, height]`, in a 400px wide viewport.
  type Box = [number, number, number, number]

  function layout({ target, panel }: { target: Box; panel: Box }) {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const box = this.matches('[data-slot="pliant-ask-panel"]')
          ? panel
          : this.matches('[data-pliant-id="orders-table"]')
            ? target
            : null
        return box ? new DOMRect(...box) : new DOMRect()
      }
    )
  }

  const docked: Box = [0, 340, 400, 300]

  function reducedMotion(matches: boolean) {
    vi.stubGlobal("matchMedia", (query: string) => ({ media: query, matches }))
  }

  beforeEach(() => {
    reducedMotion(false)
    vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(
      scrollIntoView
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    scrollIntoView.mockReset()
  })

  it("scrolls the target above the panel when a preview shows", async () => {
    layout({ target: [0, 600, 400, 200], panel: docked })
    await renderPanel()
    answer(okAnswer)
    prompt().focus()

    await ask()

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(
      document.querySelector('[data-pliant-id="orders-table"]')
    )
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      behavior: "smooth",
    })
    expect(document.activeElement).toBe(prompt())
  })

  it("scrolls instantly when motion is reduced", async () => {
    reducedMotion(true)
    layout({ target: [0, 600, 400, 200], panel: docked })
    await renderPanel()
    answer(okAnswer)

    await ask()

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      behavior: "instant",
    })
  })

  it.each<[string, Box, Box]>([
    ["a target that shows above the panel", [0, 40, 400, 200], docked],
    ["a target that starts near the top", [0, 100, 400, 400], docked],
    ["beside a panel at the side", [0, 600, 280, 200], [300, 0, 100, 800]],
    ["beside a floating panel", [0, 500, 200, 200], [220, 400, 160, 300]],
    [
      "under a panel that reaches the top",
      [0, 600, 400, 200],
      [0, 0, 400, 800],
    ],
  ])("doesn't scroll %s", async (_, target, panel) => {
    layout({ target, panel })
    await renderPanel()
    answer(okAnswer)

    await ask()

    expect(previewShown()).toBe(true)
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it("doesn't scroll without a preview", async () => {
    layout({ target: [0, 600, 400, 200], panel: docked })
    await renderPanel()
    answer({ status: "error", message: "Something went wrong." })

    await ask()

    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})
