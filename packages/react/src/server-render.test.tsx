// @vitest-environment node
import { renderToString } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { PliantRoot } from "./pliant-root"
import type { StorageAdapter } from "./storage-adapter"
import { useMountedNodes } from "./use-mounted-nodes"
import { usePreview } from "./use-preview"
import { useRegionSlots } from "./use-region-slots"
import { useResolved } from "./use-resolved"
import { useSlotContent } from "./use-slot-content"

function Probe() {
  useMountedNodes(["orders-table"])
  const { properties } = useResolved()
  const preview = usePreview()
  return (
    <output>
      {properties.size}:{preview === null ? "none" : preview.id}
    </output>
  )
}

describe("PliantRoot on the server", () => {
  it("renders without touching storage", () => {
    const load = vi.fn(() => ({}))
    const storage: StorageAdapter = { load, save: vi.fn() }

    expect(typeof window).toBe("undefined")
    expect(
      renderToString(
        <PliantRoot surface="/orders" storage={storage}>
          <Probe />
        </PliantRoot>
      )
    ).toBe("<output>0<!-- -->:<!-- -->none</output>")
    expect(load).not.toHaveBeenCalled()
  })

  it("renders with the default adapter", () => {
    expect(
      renderToString(
        <PliantRoot surface="/orders">
          <Probe />
        </PliantRoot>
      )
    ).toContain("none")
  })

  it("renders no slot content declared by a region", () => {
    function Region() {
      useRegionSlots("key-metrics", { revenue: "Revenue" })
      return <output>{useSlotContent("revenue") ?? "none"}</output>
    }

    expect(
      renderToString(
        <PliantRoot surface="/orders">
          <Region />
        </PliantRoot>
      )
    ).toBe("<output>none</output>")
  })
})
