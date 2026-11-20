import { use, useInsertionEffect, useLayoutEffect, type ReactNode } from "react"
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PliantActivity } from "./pliant-activity"
import { PliantRoot } from "./pliant-root"
import { RetainScopeContext } from "./retain-scope-context"
import type { RetainScope } from "./retention"
import { useRegionSlots } from "./use-region-slots"
import { useResolved } from "./use-resolved"
import { useSlotContent } from "./use-slot-content"

function Region({
  id,
  slots,
}: {
  id: string
  slots: Record<string, ReactNode>
}) {
  useRegionSlots(id, slots)
  return null
}

function Content({ id }: { id: string }) {
  return <output>{useSlotContent(id) ?? "none"}</output>
}

function MountedIds() {
  const { baseIds } = useResolved()
  return <output>{[...(baseIds?.ids ?? [])].join(",")}</output>
}

function outputs() {
  return screen.getAllByRole("status").map((output) => output.textContent)
}

function Page({
  mode = "visible",
  shown = true,
  children,
}: {
  mode?: "visible" | "hidden"
  shown?: boolean
  children: ReactNode
}) {
  return (
    <PliantRoot surface="/dashboard">
      <Content id="card" />
      <MountedIds />
      {shown && <PliantActivity mode={mode}>{children}</PliantActivity>}
    </PliantRoot>
  )
}

async function settled() {
  await act(() => Promise.resolve())
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("PliantActivity", () => {
  it("holds from the mutation phase that hides to the layout phase that shows", () => {
    const scopes: RetainScope[] = []
    const held: number[] = []
    function Scope() {
      const scope = use(RetainScopeContext)
      useLayoutEffect(() => {
        if (scope) {
          scopes.push(scope)
        }
      }, [scope])
      return null
    }
    function Probe({ mode }: { mode: string }) {
      useInsertionEffect(() => {
        held.push(scopes[0]?.held ?? -1)
      }, [mode])
      return null
    }
    function Tree({ mode }: { mode: "visible" | "hidden" }) {
      return (
        <PliantRoot surface="/dashboard">
          <PliantActivity mode={mode}>
            <Scope />
          </PliantActivity>
          <Probe mode={mode} />
        </PliantRoot>
      )
    }
    const { rerender } = render(<Tree mode="visible" />)
    rerender(<Tree mode="hidden" />)
    rerender(<Tree mode="visible" />)

    expect(held).toEqual([-1, 1, 1])
  })

  it("keeps a region registered while hidden, until it unmounts", async () => {
    const region = <Region id="inner" slots={{ card: "Card" }} />
    const { rerender } = render(<Page>{region}</Page>)
    await settled()

    rerender(<Page mode="hidden">{region}</Page>)
    await settled()
    expect(outputs()).toEqual(["Card", "inner,card"])

    rerender(
      <Page mode="hidden" shown={false}>
        {region}
      </Page>
    )
    await settled()
    expect(outputs()).toEqual(["none", ""])
  })

  it("keeps a region registered when shown again before settling", async () => {
    const region = <Region id="inner" slots={{ card: "Card" }} />
    const { rerender } = render(<Page>{region}</Page>)
    await settled()

    rerender(<Page mode="hidden">{region}</Page>)
    rerender(<Page>{region}</Page>)
    expect(outputs()[0]).toBe("Card")
    await settled()
    expect(outputs()).toEqual(["Card", "inner,card"])
  })

  it("keeps holding when an activity around a hidden one shows", async () => {
    function Nested({
      outer,
      inner,
    }: {
      outer: "visible" | "hidden"
      inner: "visible" | "hidden"
    }) {
      return (
        <Page mode={outer}>
          <PliantActivity mode={inner}>
            <Region id="inner" slots={{ card: "Card" }} />
          </PliantActivity>
        </Page>
      )
    }
    const { rerender } = render(<Nested outer="visible" inner="visible" />)
    await settled()
    rerender(<Nested outer="visible" inner="hidden" />)
    await settled()
    rerender(<Nested outer="hidden" inner="hidden" />)
    await settled()
    rerender(<Nested outer="visible" inner="hidden" />)
    await settled()
    expect(outputs()).toEqual(["Card", "inner,card"])

    rerender(<Nested outer="visible" inner="visible" />)
    await settled()
    expect(outputs()).toEqual(["Card", "inner,card"])
  })

  it("releases what a nested activity held when hidden content unmounts", async () => {
    function Nested({
      outer,
      inner,
      shown = true,
    }: {
      outer: "visible" | "hidden"
      inner: "visible" | "hidden"
      shown?: boolean
    }) {
      return (
        <Page mode={outer} shown={shown}>
          <PliantActivity mode={inner}>
            <Region id="inner" slots={{ card: "Card" }} />
          </PliantActivity>
        </Page>
      )
    }
    const { rerender } = render(<Nested outer="visible" inner="visible" />)
    await settled()
    rerender(<Nested outer="hidden" inner="visible" />)
    await settled()
    rerender(<Nested outer="hidden" inner="hidden" />)
    await settled()
    expect(outputs()).toEqual(["Card", "inner,card"])

    rerender(<Nested outer="hidden" inner="hidden" shown={false} />)
    await settled()
    expect(outputs()).toEqual(["none", ""])
  })

  it("releases what nested activities hidden together held when they unmount", async () => {
    function Nested({
      mode,
      shown = true,
    }: {
      mode: "visible" | "hidden"
      shown?: boolean
    }) {
      return (
        <Page mode={mode} shown={shown}>
          <PliantActivity mode={mode}>
            <Region id="inner" slots={{ card: "Card" }} />
          </PliantActivity>
        </Page>
      )
    }
    const { rerender } = render(<Nested mode="visible" />)
    await settled()
    rerender(<Nested mode="hidden" />)
    await settled()
    expect(outputs()).toEqual(["Card", "inner,card"])

    rerender(<Nested mode="hidden" shown={false} />)
    await settled()
    expect(outputs()).toEqual(["none", ""])
  })

  it("registers a region first rendered hidden once it shows", async () => {
    const region = <Region id="inner" slots={{ card: "Card" }} />
    const { rerender } = render(<Page mode="hidden">{region}</Page>)
    await settled()
    expect(outputs()).toEqual(["none", ""])

    rerender(<Page>{region}</Page>)
    await settled()
    expect(outputs()).toEqual(["Card", "inner,card"])

    rerender(<Page shown={false}>{region}</Page>)
    await settled()
    expect(outputs()).toEqual(["none", ""])
  })

  it("lets a region remounted with a new key win at once, without warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const { rerender } = render(
      <Page>
        <Region key="a" id="inner" slots={{ card: "Old" }} />
      </Page>
    )
    await settled()

    rerender(
      <Page>
        <Region key="b" id="inner" slots={{ card: "New" }} />
      </Page>
    )
    expect(outputs()[0]).toBe("New")
    await settled()
    expect(outputs()).toEqual(["New", "inner,card"])
    expect(warn).not.toHaveBeenCalled()
  })
})
