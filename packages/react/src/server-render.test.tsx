// @vitest-environment node
import { renderToString } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { memoryStorage, stored } from "../test/storage"
import { localAdapter } from "./local-adapter"
import { PliantPrePaint } from "./pliant-pre-paint"
import { PliantRoot } from "./pliant-root"
import type { StorageAdapter } from "./storage-adapter"
import { useMountedNodes } from "./use-mounted-nodes"
import { usePliantRegion } from "./use-pliant-region"
import { usePreview } from "./use-preview"
import { useRegionSlots } from "./use-region-slots"
import { useResolved } from "./use-resolved"
import { useSlotContent } from "./use-slot-content"

function Probe() {
  useMountedNodes(["orders-table"])
  const { properties } = useResolved()
  const preview = usePreview()
  return (
    <output>{`${String(properties.size)}:${preview?.id ?? "none"}`}</output>
  )
}

describe("PliantRoot on the server", () => {
  it("renders without touching storage", () => {
    const load = vi.fn(() => ({}))
    const storage: StorageAdapter = { ...memoryStorage().storage, load }

    expect(typeof window).toBe("undefined")
    expect(
      renderToString(
        <PliantRoot surface="/orders" storage={storage}>
          <Probe />
        </PliantRoot>
      )
    ).toBe("<output>0:none</output>")
    expect(load).not.toHaveBeenCalled()
  })

  it("renders with the default adapter", () => {
    expect(
      renderToString(
        <PliantRoot surface="/orders" storage={localAdapter}>
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
        <PliantRoot surface="/orders" storage={localAdapter}>
          <Region />
        </PliantRoot>
      )
    ).toBe("<output>none</output>")
  })

  it("renders a region in the order of the layers it is given", () => {
    function Region() {
      const { entries } = usePliantRegion("key-metrics", {
        revenue: "Revenue",
        overdue: "Overdue",
      })
      return (
        <output>
          {entries
            .map((entry) => (entry.kind === "slot" ? entry.id : ""))
            .join(",")}
        </output>
      )
    }
    const personal = stored({
      v: 1,
      id: "01KAB0000000000000000000P1",
      surface: "/orders",
      layer: "personal",
      ops: [
        { op: "move", target: "key-metrics/slots/overdue", to: { index: 0 } },
      ],
      basis: { contract: 1, core: "0.0.0", manifests: {} },
      source: "manual",
      createdBy: "local",
      createdAt: "2026-11-19T00:00:00.000Z",
    })

    expect(
      renderToString(
        <PliantRoot
          surface="/orders"
          storage={localAdapter}
          layers={{ personal }}
        >
          <Region />
        </PliantRoot>
      )
    ).toBe("<output>overdue,revenue</output>")
  })
})

describe("PliantPrePaint on the server", () => {
  it("renders a script that runs, with the nonce", () => {
    const html = renderToString(
      <PliantPrePaint surface="/orders" nonce="n0nce" />
    )

    expect(html).toMatch(/^<script nonce="n0nce">/)
  })

  it("keeps a surface that closes the script inside it", () => {
    const html = renderToString(
      <PliantPrePaint surface="</script><script>alert(1)</script>" />
    )

    expect(html.match(/<\/script>/gi)).toHaveLength(1)
  })
})
