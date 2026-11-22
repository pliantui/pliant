import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"

import { DemoFrame } from "@/components/demo/demo-frame"
import { KeyMetrics } from "@/registry/examples/key-metrics"

export function PliantRootDemo() {
  return (
    // Every Pliant component on the page reads its layers from this root.
    <PliantRoot surface="/docs/components/pliant-root" storage={localAdapter}>
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
