interface BlockFile {
  // The file's path from the site's root.
  src: string
  // Where the file goes in an app, as the Code view names it.
  target: string
}

export interface Block {
  name: string
  // The block's name in the blocks nav.
  label: string
  description: string
  // The block's own files, as the Code view lists them.
  files: BlockFile[]
  // The published registry items the block is built from.
  components: string[]
}

// The blocks the blocks page shows, in order.
export const blocks = [
  {
    name: "analytics-dashboard",
    label: "Analytics dashboard",
    description: "A dashboard with key metrics and an order value chart",
    files: [
      {
        src: "registry/blocks/analytics-dashboard/analytics-dashboard.tsx",
        target: "components/analytics-dashboard.tsx",
      },
      {
        src: "registry/blocks/analytics-dashboard/key-metrics.tsx",
        target: "components/key-metrics.tsx",
      },
      {
        src: "app/(examples)/examples/orders/components/kpi-card.tsx",
        target: "components/kpi-card.tsx",
      },
      {
        src: "components/demo/demo-chart.tsx",
        target: "components/demo-chart.tsx",
      },
    ],
    components: ["pliant-region"],
  },
  {
    name: "orders-list",
    label: "Orders list",
    description: "A list of recent orders",
    files: [
      {
        src: "app/(home)/components/orders-card.tsx",
        target: "components/orders-table.tsx",
      },
      {
        src: "app/(examples)/examples/orders/components/columns.tsx",
        target: "components/columns.tsx",
      },
    ],
    components: ["pliant-data-table"],
  },
  {
    name: "ticket-form",
    label: "Ticket form",
    description: "A support ticket form",
    files: [
      {
        src: "app/(examples)/examples/tickets/components/ticket-form.tsx",
        target: "components/ticket-form.tsx",
      },
    ],
    components: ["pliant-form"],
  },
  {
    name: "settings-page",
    label: "Settings page",
    description: "An account settings page with notification settings",
    files: [
      {
        src: "registry/blocks/settings-page/settings-page.tsx",
        target: "components/settings-page.tsx",
      },
    ],
    components: ["pliant-region"],
  },
  {
    name: "app-sidebar",
    label: "App sidebar",
    description: "A support desk sidebar beside its page",
    files: [
      {
        src: "registry/blocks/app-sidebar/app-sidebar.tsx",
        target: "components/app-sidebar.tsx",
      },
      {
        src: "app/(home)/components/sidebar-card.tsx",
        target: "components/workspace-sidebar.tsx",
      },
      {
        src: "app/(examples)/examples/app/sections.tsx",
        target: "components/sections.tsx",
      },
    ],
    components: ["pliant-nav"],
  },
  {
    name: "crm-pipeline",
    label: "CRM pipeline",
    description: "A sales pipeline board with a column per stage",
    files: [
      {
        src: "registry/blocks/crm-pipeline/crm-pipeline.tsx",
        target: "components/crm-pipeline.tsx",
      },
    ],
    components: [],
  },
  {
    name: "team-workspace",
    label: "Team workspace",
    description: "A team page with members, activity and shared views",
    files: [
      {
        src: "registry/blocks/team-workspace/team-workspace.tsx",
        target: "components/team-workspace.tsx",
      },
    ],
    components: ["pliant-region"],
  },
] as const satisfies Block[]

export type BlockName = (typeof blocks)[number]["name"]
