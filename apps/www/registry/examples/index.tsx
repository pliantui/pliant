import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"
import { PliantPrePaint } from "@pliantui/react/pre-paint"

import { askTargets } from "@/app/(examples)/examples/orders/ask-targets"
import { DemoAskToolbar } from "@/components/demo/demo-ask-toolbar"
import { DemoFrame } from "@/components/demo/demo-frame"
import { orders, team } from "@/lib/demo/data"
import { WorkspaceSidebar } from "@/registry/blocks/app-sidebar/workspace-sidebar"
import { TicketForm } from "@/registry/blocks/ticket-form/ticket-form"
import { AskPanelDemo } from "@/registry/examples/ask-panel-demo"
import { KeyMetrics } from "@/registry/examples/key-metrics"
import { OrdersTableDemo } from "@/registry/examples/orders-table-demo"

const keyMetricsAsks = [
  "put the overdue card first",
  "hide the average order value card",
  "show the cards in a two-column grid",
]

function KeyMetricsDemo({
  surface,
  prePaint = false,
  toolbar,
}: {
  surface: string
  prePaint?: boolean
  toolbar?: React.ReactNode
}) {
  return (
    <PliantRoot surface={surface} storage={localAdapter}>
      {prePaint && <PliantPrePaint surface={surface} />}
      <DemoFrame
        target="key-metrics"
        label="key metrics"
        asks={keyMetricsAsks}
        toolbar={toolbar}
      >
        <KeyMetrics />
      </DemoFrame>
    </PliantRoot>
  )
}

// The live previews component pages show, by name. Each renders the
// component in the shared demo company's app, with its asks and a Reset.
// `file` is the source the Code tab shows: a standalone version of the
// same usage, from the checked snippets.
export const examples = {
  "pliant-root-demo": {
    file: "snippets/components/root.tsx",
    render: () => <KeyMetricsDemo surface="/docs/components/pliant-root" />,
  },
  "region-demo": {
    file: "snippets/components/region.tsx",
    render: () => <KeyMetricsDemo surface="/docs/components/region" />,
  },
  "pre-paint-demo": {
    file: "snippets/components/pre-paint.tsx",
    render: () => (
      <KeyMetricsDemo surface="/docs/components/pre-paint" prePaint />
    ),
  },
  "data-table-demo": {
    file: "snippets/first-table/orders-table.tsx",
    render: () => (
      <PliantRoot surface="/docs/components/data-table" storage={localAdapter}>
        <DemoFrame
          target="orders-table"
          label="orders table"
          asks={[
            "sort by value, highest first",
            "only show overdue orders",
            "hide the notes column",
            "put customer before order",
          ]}
        >
          <OrdersTableDemo data={orders.slice(0, 48)} />
        </DemoFrame>
      </PliantRoot>
    ),
  },
  "form-demo": {
    file: "registry/blocks/ticket-form/ticket-form.tsx",
    render: () => (
      <PliantRoot surface="/docs/components/form" storage={localAdapter}>
        <DemoFrame
          target="ticket-form"
          label="ticket form"
          asks={["put priority first", "hide the CC field"]}
        >
          <div className="mx-auto w-full max-w-md">
            <TicketForm />
          </div>
        </DemoFrame>
      </PliantRoot>
    ),
  },
  "nav-demo": {
    file: "snippets/components/nav.tsx",
    render: () => (
      <PliantRoot surface="/docs/components/nav" storage={localAdapter}>
        <DemoFrame
          target="workspace-nav"
          label="support desk sidebar"
          asks={["pin customers to the top", "hide reports"]}
        >
          <div className="mx-auto w-full max-w-64">
            <WorkspaceSidebar
              user={team.find((member) => member.team === "Support")}
            />
          </div>
        </DemoFrame>
      </PliantRoot>
    ),
  },
  "ask-panel-demo": {
    file: "snippets/components/ask-panel.tsx",
    render: () => (
      <KeyMetricsDemo
        surface="/docs/components/ask-panel"
        toolbar={<AskPanelDemo />}
      />
    ),
  },
  "point-mode-demo": {
    file: "snippets/ai/ask-toolbar.tsx",
    render: () => (
      <KeyMetricsDemo
        surface="/docs/components/point-mode"
        toolbar={
          <DemoAskToolbar
            targets={askTargets.filter(({ id }) => id === "key-metrics")}
          />
        }
      />
    ),
  },
} satisfies Record<string, { file: string; render: () => React.ReactNode }>

export type ExampleName = keyof typeof examples
