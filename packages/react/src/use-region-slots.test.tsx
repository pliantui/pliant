import { StrictMode, useState, type ReactNode } from "react"
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PliantRoot } from "./pliant-root"
import { useRegionSlots } from "./use-region-slots"
import { useResolved } from "./use-resolved"
import { useSlotContent } from "./use-slot-content"

const slots = { revenue: <p>Revenue</p>, orders: <p>Orders</p> }

function Region({
  id,
  slots: declared,
}: {
  id: string
  slots: Record<string, ReactNode>
}) {
  useRegionSlots(id, declared)
  return null
}

function Content({ id }: { id: string }) {
  return <output>{useSlotContent(id) ?? "none"}</output>
}

function MountedIds() {
  const { baseIds } = useResolved()
  return <output>{[...(baseIds?.ids ?? [])].join(",")}</output>
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("useRegionSlots", () => {
  it("registers the region and its slots as mounted", async () => {
    render(
      <PliantRoot surface="/dashboard">
        <Region id="key-metrics" slots={slots} />
        <MountedIds />
      </PliantRoot>
    )

    expect(
      (await screen.findByText("key-metrics,revenue,orders")).tagName
    ).toBe("OUTPUT")
  })

  it("shares slot content with useSlotContent while mounted", () => {
    function Toggle() {
      const [shown, setShown] = useState(true)
      return (
        <>
          {shown && <Region id="key-metrics" slots={slots} />}
          <button
            type="button"
            onClick={() => {
              setShown(false)
            }}
          >
            Unmount
          </button>
        </>
      )
    }
    render(
      <StrictMode>
        <PliantRoot surface="/dashboard">
          <Content id="orders" />
          <Toggle />
        </PliantRoot>
      </StrictMode>
    )

    expect(screen.getByRole("status").textContent).toBe("Orders")
    act(() => {
      screen.getByRole("button").click()
    })
    expect(screen.getByRole("status").textContent).toBe("none")
  })

  it("updates shared content when the slots change", () => {
    const { rerender } = render(
      <PliantRoot surface="/dashboard">
        <Region id="key-metrics" slots={{ revenue: "$1" }} />
        <Content id="revenue" />
      </PliantRoot>
    )
    expect(screen.getByRole("status").textContent).toBe("$1")

    rerender(
      <PliantRoot surface="/dashboard">
        <Region id="key-metrics" slots={{ revenue: "$2" }} />
        <Content id="revenue" />
      </PliantRoot>
    )
    expect(screen.getByRole("status").textContent).toBe("$2")
  })

  it("throws outside a PliantRoot", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    expect(() => render(<Region id="key-metrics" slots={slots} />)).toThrow(
      "useRegionSlots must be used within a PliantRoot"
    )
  })
})
