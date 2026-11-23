import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"
import { PliantPrePaint } from "@pliantui/react/pre-paint"

import { askTargets } from "@/app/(examples)/examples/orders/ask-targets"
import { DemoFrame } from "@/components/demo/demo-frame"
import {
  ordersTableAsks,
  ticketFormAsks,
  workspaceNavAsks,
} from "@/lib/demo/asks"
import { orders, team } from "@/lib/demo/data"
import { getQuarterRefundRate } from "@/lib/demo/stats"
import { WorkspaceSidebar } from "@/registry/blocks/app-sidebar/workspace-sidebar"
import { TicketForm } from "@/registry/blocks/ticket-form/ticket-form"
import { KeyMetrics } from "@/registry/examples/key-metrics"
import { KeyMetricsFrame } from "@/registry/examples/key-metrics-frame"
import { OrdersTableDemo } from "@/registry/examples/orders-table-demo"

const keyMetricsTargets = askTargets.filter(({ id }) => id === "key-metrics")

function KeyMetricsDemo({
  surface,
  prePaint = false,
  ask = false,
  pointMode = false,
}: {
  surface: string
  prePaint?: boolean
  // Whether Ask opens the ask panel rather than the suggested asks.
  ask?: boolean
  pointMode?: boolean
}) {
  return (
    <PliantRoot surface={surface} storage={localAdapter}>
      {prePaint && <PliantPrePaint surface={surface} />}
      <KeyMetricsFrame
        // The drawn refund rate card isn't a saved change, so pre-paint
        // couldn't bring it back on reload.
        refundRate={prePaint ? undefined : getQuarterRefundRate(orders)}
        askTargets={ask ? keyMetricsTargets : undefined}
        pointMode={pointMode}
      >
        <KeyMetrics />
      </KeyMetricsFrame>
    </PliantRoot>
  )
}

// The live previews component pages show, by name. Each renders the
// component in the shared demo company's app, with its asks and its Customize menu.
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
          asks={ordersTableAsks}
          adjustable
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
          asks={ticketFormAsks}
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
          asks={workspaceNavAsks}
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
    render: () => <KeyMetricsDemo surface="/docs/components/ask-panel" ask />,
  },
  "customize-menu-demo": {
    file: "snippets/components/ask-panel-trigger.tsx",
    render: () => <KeyMetricsDemo surface="/docs/components/customize-menu" />,
  },
  "customize-icon-demo": {
    file: "registry/pliant/customize-icon.tsx",
    render: () => <KeyMetricsDemo surface="/docs/components/customize-icon" />,
  },
  "point-mode-demo": {
    file: "snippets/ai/ask-toolbar.tsx",
    render: () => (
      <KeyMetricsDemo surface="/docs/components/point-mode" ask pointMode />
    ),
  },
} satisfies Record<string, { file: string; render: () => React.ReactNode }>

export type ExampleName = keyof typeof examples
