import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"

import { DemoFrame } from "@/components/demo/demo-frame"

const keyMetricsAsks = [
  "put the overdue card first",
  "hide the average order value card",
]

// The live examples component pages show, by name. `file` is the source the
// Code tab shows: the example itself, or the component it's built around.
export const examples = {
  "pliant-root-demo": {
    file: "registry/examples/pliant-root-demo.tsx",
    render: async () => {
      const { PliantRootDemo } = await import("./pliant-root-demo")
      return <PliantRootDemo />
    },
  },
  "region-demo": {
    file: "registry/examples/region-demo.tsx",
    render: async () => {
      const { RegionDemo } = await import("./region-demo")
      return <RegionDemo />
    },
  },
  "pre-paint-demo": {
    file: "registry/examples/pre-paint-demo.tsx",
    render: async () => {
      const { PrePaintDemo } = await import("./pre-paint-demo")
      return <PrePaintDemo />
    },
  },
  "data-table-demo": {
    file: "registry/examples/orders-table-demo.tsx",
    render: async () => {
      const { DataTableDemo } = await import("./data-table-demo")
      return <DataTableDemo />
    },
  },
  "form-demo": {
    file: "app/(examples)/examples/tickets/components/ticket-form.tsx",
    render: async () => {
      const { FormDemo } = await import("./form-demo")
      return <FormDemo />
    },
  },
  "nav-demo": {
    file: "app/(home)/components/sidebar-card.tsx",
    render: async () => {
      const { NavDemo } = await import("./nav-demo")
      return <NavDemo />
    },
  },
  "ask-panel-demo": {
    file: "registry/examples/ask-panel-demo.tsx",
    render: async () => {
      const [{ AskPanelDemo }, { KeyMetrics }] = await Promise.all([
        import("./ask-panel-demo"),
        import("./key-metrics"),
      ])
      return (
        <PliantRoot surface="/docs/components/ask-panel" storage={localAdapter}>
          <DemoFrame
            target="key-metrics"
            label="key metrics"
            asks={keyMetricsAsks}
            toolbar={<AskPanelDemo />}
          >
            <KeyMetrics />
          </DemoFrame>
        </PliantRoot>
      )
    },
  },
  "point-mode-demo": {
    file: "registry/examples/point-mode-demo.tsx",
    render: async () => {
      const [{ PointModeDemo }, { KeyMetrics }] = await Promise.all([
        import("./point-mode-demo"),
        import("./key-metrics"),
      ])
      return (
        <PliantRoot
          surface="/docs/components/point-mode"
          storage={localAdapter}
        >
          <DemoFrame
            target="key-metrics"
            label="key metrics"
            asks={keyMetricsAsks}
            toolbar={<PointModeDemo />}
          >
            <KeyMetrics />
          </DemoFrame>
        </PliantRoot>
      )
    },
  },
} satisfies Record<
  string,
  { file: string; render: () => Promise<React.ReactNode> }
>

export type ExampleName = keyof typeof examples
