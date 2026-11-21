import type { MouseEvent } from "react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { RegionEntry } from "@pliantui/core"

import { useRegionItems } from "./use-region-items"

function slot(
  id: string,
  options: Partial<Omit<RegionEntry, "kind" | "id">> = {}
): RegionEntry {
  return { kind: "slot", id, visible: true, ...options }
}

const more = { into: "more", label: "More metrics" } as const

function Items({ entries }: { entries: readonly RegionEntry[] }) {
  const items = useRegionItems(entries)
  return items.map((item) =>
    item.kind === "trigger" ? (
      <button key={item.key} {...item.getTriggerProps()}>
        {item.label ?? "More"}
      </button>
    ) : (
      <div key={item.key} {...item.props} data-mode={item.mode}>
        <button type="button">{item.entry.id}</button>
      </div>
    )
  )
}

function order() {
  return [
    ...document.body.querySelectorAll("[data-pliant-id], [aria-expanded]"),
  ].map(
    (element) =>
      element.getAttribute("data-pliant-id") ?? `trigger:${element.textContent}`
  )
}

function wrapper(id: string) {
  const element = document.querySelector(`[data-pliant-id="${id}"]`)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`No entry ${id}`)
  }
  return element
}

afterEach(() => {
  cleanup()
})

function InvalidItems({
  entries,
  invalid,
}: {
  entries: readonly RegionEntry[]
  invalid: readonly string[]
}) {
  const items = useRegionItems(entries)
  return (
    <form aria-label="Ticket">
      {items.map((item) =>
        item.kind === "trigger" ? (
          <button key={item.key} {...item.getTriggerProps()}>
            More fields
          </button>
        ) : (
          <div key={item.key} {...item.props} data-mode={item.mode}>
            <input
              aria-label={item.entry.id}
              aria-invalid={invalid.includes(item.entry.id)}
              required={item.entry.id === "due"}
            />
          </div>
        )
      )}
    </form>
  )
}

describe("useRegionItems", () => {
  it("gives each entry its wrapper props and mode", () => {
    render(
      <Items
        entries={[
          slot("revenue", { pinned: "start" }),
          slot("orders", { visible: false }),
        ]}
      />
    )

    expect(order()).toEqual(["revenue", "orders"])
    expect(wrapper("revenue").getAttribute("data-pliant-pinned")).toBe("start")
    expect(wrapper("revenue").getAttribute("data-mode")).toBe("visible")
    expect(wrapper("orders").getAttribute("data-mode")).toBe("hidden")
    expect(wrapper("revenue").id).not.toBe(wrapper("orders").id)
  })

  it("puts a collapse's entries after its trigger, at the first one's place", () => {
    render(
      <Items
        entries={[
          slot("revenue"),
          slot("orders", { collapsed: more }),
          slot("refunds"),
          slot("overdue", { collapsed: more }),
          slot("notes", { collapsed: { into: "more" } }),
        ]}
      />
    )

    expect(order()).toEqual([
      "revenue",
      "trigger:More metrics",
      "orders",
      "overdue",
      "refunds",
      "trigger:More",
      "notes",
    ])
  })

  it("opens and closes a collapse from its trigger", () => {
    render(
      <Items entries={[slot("revenue"), slot("orders", { collapsed: more })]} />
    )
    const trigger = screen.getByRole("button", { name: "More metrics" })
    expect(trigger.getAttribute("type")).toBe("button")
    expect(trigger.getAttribute("data-pliant-collapse")).toBe("more")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(wrapper("orders").getAttribute("data-mode")).toBe("hidden")

    fireEvent.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(wrapper("orders").getAttribute("data-mode")).toBe("visible")

    fireEvent.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(wrapper("orders").getAttribute("data-mode")).toBe("hidden")
  })

  it("points the trigger at the entries it controls", () => {
    render(
      <Items
        entries={[
          slot("revenue"),
          slot("orders", { collapsed: more }),
          slot("overdue", { collapsed: more }),
        ]}
      />
    )

    const controls = screen
      .getByRole("button", { name: "More metrics" })
      .getAttribute("aria-controls")
      ?.split(" ")
      .map((id) => document.getElementById(id)?.getAttribute("data-pliant-id"))
    expect(controls).toEqual(["orders", "overdue"])
  })

  it("gives each item its collapse group, and each trigger its members", () => {
    const { result } = renderHook(() =>
      useRegionItems([
        slot("revenue"),
        slot("orders", { collapsed: more }),
        slot("overdue", { collapsed: more }),
      ])
    )

    const [revenue, trigger, orders, overdue] = result.current
    expect(trigger?.kind).toBe("trigger")
    if (trigger?.kind !== "trigger") return
    expect(trigger.members).toEqual(["orders", "overdue"])
    expect(revenue).toMatchObject({ key: "revenue", group: undefined })
    expect(orders).toMatchObject({ key: "orders", group: trigger.group })
    expect(overdue).toMatchObject({ key: "overdue", group: trigger.group })
  })

  it("runs the trigger's own onClick first, and lets it prevent the toggle", () => {
    const onClick = vi.fn((event: MouseEvent<HTMLButtonElement>) => {
      if (onClick.mock.calls.length > 1) {
        event.preventDefault()
      }
    })
    function Trigger() {
      const trigger = useRegionItems([
        slot("orders", { collapsed: more }),
      ]).find((item) => item.kind === "trigger")
      return (
        <button {...trigger?.getTriggerProps({ onClick })}>
          {trigger?.label}
        </button>
      )
    }
    render(<Trigger />)
    const button = screen.getByRole("button", { name: "More metrics" })

    fireEvent.click(button)
    expect(button.getAttribute("aria-expanded")).toBe("true")
    fireEvent.click(button)
    expect(button.getAttribute("aria-expanded")).toBe("true")
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it("leaves out the trigger when its entries are all hidden", () => {
    render(
      <Items entries={[slot("orders", { collapsed: more, visible: false })]} />
    )

    expect(order()).toEqual(["orders"])
  })

  it.each([["More metrics"], ["a\tb\nc"]])(
    "moves focus to the trigger %j when an op collapses the focused entry",
    (label) => {
      const { rerender } = render(
        <Items entries={[slot("revenue"), slot("orders")]} />
      )
      screen.getByRole("button", { name: "orders" }).focus()

      act(() => {
        rerender(
          <Items
            entries={[
              slot("revenue"),
              slot("orders", { collapsed: { into: "more", label } }),
            ]}
          />
        )
      })

      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: label })
      )
    }
  )

  describe("with an invalid control in a collapse", () => {
    const entries = [
      slot("title"),
      slot("cc", { collapsed: more }),
      slot("due", { collapsed: more }),
    ]
    const trigger = () => screen.getByRole("button", { name: "More fields" })

    const textbox = (name: string) =>
      screen.getByRole("textbox", { name, hidden: true })

    function setup() {
      const view = render(<InvalidItems entries={entries} invalid={[]} />)
      return async (invalid: readonly string[]) => {
        view.rerender(<InvalidItems entries={entries} invalid={invalid} />)
        await act(async () => {
          await Promise.resolve()
        })
      }
    }

    function submit() {
      fireEvent.submit(screen.getByRole("form", { name: "Ticket" }))
    }

    function type(name: string) {
      fireEvent.keyDown(textbox(name), { key: "a" })
      fireEvent.input(textbox(name), { target: { value: "a" } })
    }

    it("opens when a submit finds a control inside invalid, and focuses it", async () => {
      const mark = setup()
      expect(trigger().getAttribute("aria-expanded")).toBe("false")

      submit()
      await mark(["title"])
      expect(trigger().getAttribute("aria-expanded")).toBe("false")

      await mark(["title", "cc"])
      expect(trigger().getAttribute("aria-expanded")).toBe("true")
      expect(wrapper("cc").getAttribute("data-mode")).toBe("visible")
      expect(document.activeElement).toBe(textbox("cc"))
    })

    it("leaves focus on an invalid control that has it", async () => {
      const mark = setup()
      await mark(["title"])
      textbox("title").focus()

      submit()
      await mark(["title", "cc"])
      expect(trigger().getAttribute("aria-expanded")).toBe("true")
      expect(document.activeElement).toBe(textbox("title"))
    })

    it("stays closed when a control inside becomes invalid as the user types", async () => {
      const mark = setup()
      textbox("title").focus()

      type("title")
      await mark(["cc"])
      expect(trigger().getAttribute("aria-expanded")).toBe("false")
      expect(document.activeElement).toBe(textbox("title"))
    })

    it("stays closed when the user types after a submit", async () => {
      const mark = setup()
      textbox("title").focus()
      submit()
      await mark(["title"])

      type("title")
      await mark(["title", "cc"])
      expect(trigger().getAttribute("aria-expanded")).toBe("false")
      expect(document.activeElement).toBe(textbox("title"))
    })

    it("lets the user close it, and opens it again only when a submit finds a newly invalid control", async () => {
      const mark = setup()
      submit()
      await mark(["cc"])
      expect(trigger().getAttribute("aria-expanded")).toBe("true")

      fireEvent.click(trigger())
      expect(trigger().getAttribute("aria-expanded")).toBe("false")
      await mark(["cc", "due"])
      expect(trigger().getAttribute("aria-expanded")).toBe("false")

      submit()
      await mark(["cc"])
      expect(trigger().getAttribute("aria-expanded")).toBe("false")

      submit()
      await mark(["cc", "due"])
      expect(trigger().getAttribute("aria-expanded")).toBe("true")
      expect(document.activeElement).toBe(textbox("due"))
    })

    it("opens before the browser reports a control its validation finds invalid", () => {
      setup()
      let shown: string | null = null
      const due = textbox("due")
      due.addEventListener("invalid", () => {
        shown = wrapper("due").getAttribute("data-mode")
      })
      act(() => {
        due.dispatchEvent(new Event("invalid"))
      })
      expect(shown).toBe("visible")
    })
  })
})
