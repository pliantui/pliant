import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"
import { PliantPrePaint } from "@pliantui/react/pre-paint"

import { DemoFrame } from "@/components/demo/demo-frame"
import { KeyMetrics } from "@/registry/examples/key-metrics"

export function PrePaintDemo() {
  return (
    <PliantRoot surface="/docs/components/pre-paint" storage={localAdapter}>
      {/* Applies the saved layout before the page paints, so a reload
          doesn't flash the original order. */}
      <PliantPrePaint surface="/docs/components/pre-paint" />
      <DemoFrame
        target="key-metrics"
        label="key metrics"
        asks={[
          "put the overdue card first",
          "hide the average order value card",
        ]}
      >
        <KeyMetrics />
      </DemoFrame>
    </PliantRoot>
  )
}
