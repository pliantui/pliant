// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Command, CommandList } from "@/components/ui/command"

import { CustomizeIcon } from "./customize-icon"
import {
  PliantCustomizeCommandGroup,
  PliantCustomizeContextMenu,
  PliantCustomizeMenu,
} from "./pliant-customize-menu"

async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
}

async function openMenu() {
  fireEvent.keyDown(screen.getByRole("button", { name: "Customize" }), {
    key: "Enter",
  })
  await settle()
}

function items() {
  return screen.getAllByRole("menuitem").map((item) => ({
    name: item.textContent,
    disabled: item.getAttribute("aria-disabled") === "true",
  }))
}

afterEach(() => {
  cleanup()
})

describe("PliantCustomizeMenu", () => {
  it("lists Ask, Adjust, History and Reset, in that order", async () => {
    render(
      <PliantCustomizeMenu
        onAsk={vi.fn()}
        onAdjust={vi.fn()}
        onHistory={vi.fn()}
        onReset={vi.fn()}
      />
    )
    await openMenu()

    expect(items()).toEqual([
      { name: "Ask for a change…", disabled: false },
      { name: "Adjust by hand", disabled: false },
      { name: "History", disabled: false },
      { name: "Reset to default", disabled: false },
    ])
    expect(screen.getAllByRole("separator")).toHaveLength(1)
  })

  it("disables an item with no handler and marks it", async () => {
    render(
      <PliantCustomizeMenu
        onReset={vi.fn()}
        canReset={false}
        unavailable={<span>(soon)</span>}
      />
    )
    await openMenu()

    expect(items()).toEqual([
      { name: "Ask for a change…(soon)", disabled: true },
      { name: "Adjust by hand(soon)", disabled: true },
      { name: "History(soon)", disabled: true },
      { name: "Reset to default", disabled: true },
    ])
  })

  it("resets and puts focus back on its button", async () => {
    const onReset = vi.fn()
    render(<PliantCustomizeMenu onReset={onReset} />)
    await openMenu()

    fireEvent.click(screen.getByRole("menuitem", { name: "Reset to default" }))
    await settle()

    expect(onReset).toHaveBeenCalledOnce()
    expect(screen.queryByRole("menu")).toBeNull()
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Customize" })
    )
  })

  it("leaves focus where Ask moved it", async () => {
    render(
      <>
        <input aria-label="Prompt" />
        <PliantCustomizeMenu
          onAsk={() => {
            screen.getByRole("textbox", { name: "Prompt" }).focus()
          }}
        />
      </>
    )
    await openMenu()

    fireEvent.click(screen.getByRole("menuitem", { name: "Ask for a change…" }))
    await settle()

    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Prompt" })
    )
  })

  it("shows a Customized mark only while the part is customized", () => {
    const { rerender } = render(<PliantCustomizeMenu />)
    expect(screen.queryByText("Customized")).toBeNull()

    rerender(<PliantCustomizeMenu customized />)
    expect(screen.getByText("Customized")).toBeTruthy()
  })
})

describe("PliantCustomizeContextMenu", () => {
  it("adds a Customize group to the right-click menu", async () => {
    const onReset = vi.fn()
    render(
      <PliantCustomizeContextMenu onAsk={vi.fn()} onReset={onReset}>
        <div>Orders</div>
      </PliantCustomizeContextMenu>
    )

    fireEvent.contextMenu(screen.getByText("Orders"))
    await settle()

    expect(screen.getByRole("group").textContent).toMatch(/^Customize/)
    expect(items().map((item) => item.name)).toEqual([
      "Ask for a change…⌘.",
      "Adjust by hand",
      "History",
      "Reset to default",
    ])
    fireEvent.click(screen.getByRole("menuitem", { name: "Reset to default" }))
    expect(onReset).toHaveBeenCalledOnce()
  })

  it("asks about the part with ⌘. or Ctrl+. while focus is inside it", () => {
    const onAsk = vi.fn()
    render(
      <>
        <button type="button">Elsewhere</button>
        <PliantCustomizeContextMenu onAsk={onAsk}>
          <div>
            <button type="button">Inside</button>
          </div>
        </PliantCustomizeContextMenu>
      </>
    )

    fireEvent.keyDown(screen.getByRole("button", { name: "Elsewhere" }), {
      key: ".",
      metaKey: true,
    })
    expect(onAsk).not.toHaveBeenCalled()

    fireEvent.keyDown(screen.getByRole("button", { name: "Inside" }), {
      key: ".",
      metaKey: true,
    })
    fireEvent.keyDown(screen.getByRole("button", { name: "Inside" }), {
      key: ".",
      ctrlKey: true,
    })
    fireEvent.keyDown(screen.getByRole("button", { name: "Inside" }), {
      key: ".",
    })
    expect(onAsk).toHaveBeenCalledTimes(2)
  })
})

describe("PliantCustomizeCommandGroup", () => {
  it("lists the items under a Customize heading", () => {
    const onAsk = vi.fn()
    render(
      <Command>
        <CommandList>
          <PliantCustomizeCommandGroup onAsk={onAsk} onReset={vi.fn()} />
        </CommandList>
      </Command>
    )

    const options = screen.getAllByRole("option")
    expect(options.map((option) => option.textContent)).toEqual([
      "Ask for a change…",
      "Adjust by hand",
      "History",
      "Reset to default",
    ])
    expect(screen.getByText("Customize")).toBeTruthy()
    fireEvent.click(screen.getByRole("option", { name: "Ask for a change…" }))
    expect(onAsk).toHaveBeenCalledOnce()
  })
})

describe("CustomizeIcon", () => {
  it("takes lucide's size and stroke width, and fills when asked", () => {
    const { container, rerender } = render(
      <CustomizeIcon size={16} strokeWidth={1.5} />
    )
    const svg = () => container.querySelector("svg")
    expect(svg()?.getAttribute("width")).toBe("16")
    expect(svg()?.getAttribute("stroke-width")).toBe("1.5")
    expect(svg()?.getAttribute("fill")).toBe("none")
    expect(svg()?.getAttribute("aria-hidden")).toBe("true")

    rerender(<CustomizeIcon variant="filled" />)
    expect(svg()?.getAttribute("fill")).toBe("currentColor")
  })
})
