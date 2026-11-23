import { mockupAsks } from "@/lib/components/mockup-asks"

export interface MockupPage {
  slug: string
  registryItem: string
  dependencies: string[]
  usage: { imports: string; code: string }
  asks: { prompt: string; result: string }[]
  rules: string[]
  examples: { title: string; description: string; code: string }[]
  options: {
    component: string
    props: {
      name: string
      type: string
      default?: string
      description: string
    }[]
  }[]
  accessibility: string[]
}

export const mockupPages: MockupPage[] = [
  {
    slug: "messages",
    registryItem: "pliant-messages",
    dependencies: ["@pliantui/react"],
    usage: {
      imports: `import { PliantMessage } from "@/components/pliant/pliant-messages"`,
      code: `<PliantMessage id="overdueTitle" target="key-metrics/slots/overdue" />`,
    },
    asks: [
      {
        prompt: mockupAsks.messages.renameOverdue,
        result:
          'The card\'s title reads "Dues" for this user, in place of "Overdue".',
      },
      {
        prompt: mockupAsks.messages.renameAov,
        result:
          'The card\'s label becomes "AOV", and the full name stays in its tooltip.',
      },
      {
        prompt: mockupAsks.messages.original,
        result: "The rename is dropped and the label shows your message again.",
      },
    ],
    rules: [
      "A message is renamable only when you give it a target whose part allows renaming; otherwise it always shows your text.",
      "A new label is plain text of at most 80 characters. It can't contain markup or links, and it's never read as code.",
      "Renames are kept per user, or per team when a team lead publishes them, and a lock on the part stops members renaming it.",
      "Renaming changes only the text people read. Ids, addresses and your data keep their names.",
    ],
    examples: [
      {
        title: "Declare your own messages",
        description:
          "Add your app's labels to the same messages Pliant's components use, so one translation object covers both.",
        code: `import type { PliantMessages } from "@pliantui/react"

declare module "@pliantui/react" {
  interface PliantMessages {
    overdueTitle: string
    ordersShown: (count: number) => string
  }
}

export const messages = {
  overdueTitle: "Overdue",
  ordersShown: (count) => \`\${count} orders\`,
} satisfies Partial<PliantMessages>`,
      },
      {
        title: "A message with values",
        description:
          "Pass the arguments of a message that's a function with values.",
        code: `<p className="text-muted-foreground text-sm">
  <PliantMessage id="ordersShown" values={[200]} />
</p>`,
      },
    ],
    options: [
      {
        component: "PliantMessage",
        props: [
          {
            name: "id",
            type: "keyof PliantMessages",
            description:
              "The message to show, from the `messages` passed to `PliantRoot` or its English default.",
          },
          {
            name: "values",
            type: "unknown[]",
            description:
              "Arguments for a message that's a function, such as a count.",
          },
          {
            name: "target",
            type: "string",
            description:
              "The address of the part this label names. A rename on that address replaces the text.",
          },
          {
            name: "fallback",
            type: "string",
            description:
              "Text to show when the message has no entry and no default.",
          },
        ],
      },
    ],
    accessibility: [
      "The message renders as plain text inside your own element, so it keeps the heading level and role you give it.",
      "When a label is renamed, its accessible name changes with it, and the original message stays available as a tooltip.",
      "The text takes the `lang` set on `PliantRoot` or `<html lang>`, so screen readers pronounce it in the right language.",
    ],
  },
  {
    slug: "chart",
    registryItem: "pliant-chart",
    dependencies: ["@pliantui/react", "recharts"],
    usage: {
      imports: `import { PliantChart } from "@/components/pliant/pliant-chart"`,
      code: `<PliantChart
  id="revenue-by-month"
  title="Revenue by month"
  data={monthlyRevenue}
  x="month"
  y={["paid", "pending", "overdue"]}
  type="area"
  format={{ type: "currency", currency: "INR" }}
/>`,
    },
    asks: [
      {
        prompt: mockupAsks.chart.bars,
        result:
          "The chart switches from an area chart to bars, with the same months and series.",
      },
      {
        prompt: mockupAsks.chart.stack,
        result:
          "Paid, pending and overdue revenue stack into one bar per month.",
      },
      {
        prompt: mockupAsks.chart.overdueOnly,
        result:
          "The paid and pending series are hidden, leaving overdue revenue on its own.",
      },
      {
        prompt: mockupAsks.chart.thisQuarter,
        result: "The chart is filtered to the months of the current quarter.",
      },
      {
        prompt: mockupAsks.chart.percent,
        result:
          "Each month's bar fills the full height, split by the share of each status.",
      },
    ],
    rules: [
      "Users choose among the fields you pass in `y`, at most eight at a time, and can't plot a field you didn't give the chart.",
      "The kind can be area, bar, line, pie, radar or radial, unless you narrow it with `types`.",
      "A time range is a filter on the data the chart already has, so it never loads rows the user isn't allowed to see.",
      "A chart in a locked region, or locked by an admin, keeps its kind and series for everyone it applies to.",
      "Reset brings back the chart as you wrote it, or as the team default has it.",
    ],
    examples: [
      {
        title: "Revenue by region",
        description:
          "A bar chart of order value per region, which users can stack by status.",
        code: `<PliantChart
  id="orders-by-region"
  title="Orders by region"
  data={orders}
  x="region"
  y={["value"]}
  series="status"
  type="bar"
  types={["bar", "pie"]}
  format={{ type: "currency", currency: "INR", decimals: 0 }}
/>`,
      },
    ],
    options: [
      {
        component: "PliantChart",
        props: [
          {
            name: "id",
            type: "string",
            description: "The chart's node id, unique on its surface.",
          },
          {
            name: "title",
            type: "string",
            description: "The heading shown above the chart.",
          },
          {
            name: "data",
            type: "readonly Record<string, unknown>[]",
            description: "The rows to plot.",
          },
          {
            name: "x",
            type: "string",
            description:
              "The field along the horizontal axis, such as `month`.",
          },
          {
            name: "y",
            type: "string[]",
            description:
              "The fields users can plot, in your default order. Up to eight.",
          },
          {
            name: "series",
            type: "string",
            description:
              "A field that splits each value into series, such as `status`.",
          },
          {
            name: "type",
            type: '"area" | "bar" | "line" | "pie" | "radar" | "radial"',
            default: '"bar"',
            description: "The chart's default kind.",
          },
          {
            name: "types",
            type: "ChartType[]",
            description: "The kinds users may switch to. All six by default.",
          },
          {
            name: "stacking",
            type: '"none" | "stacked" | "percent"',
            default: '"none"',
            description: "How series stack by default.",
          },
          {
            name: "format",
            type: "Format",
            description:
              "How values show on the axis and in tooltips, such as INR currency.",
          },
        ],
      },
    ],
    accessibility: [
      "Each chart has an accessible name from its `title`, and a summary of what it shows that updates when a user changes it.",
      "A View as table toggle shows the same numbers as a table, for screen readers and keyboard users.",
      "Series are told apart by pattern and label as well as color, so the chart reads in high contrast and for color blind users.",
    ],
  },
  {
    slug: "stat",
    registryItem: "pliant-stat",
    dependencies: ["@pliantui/react"],
    usage: {
      imports: `import { PliantStat } from "@/components/pliant/pliant-stat"`,
      code: `<PliantStat
  id="revenue"
  metrics={metrics}
  metric="revenue"
  comparison={{ metric: "revenueLastMonth", display: "percent" }}
  format={{ type: "currency", currency: "INR" }}
/>`,
    },
    asks: [
      {
        prompt: mockupAsks.stat.compare,
        result:
          "The card shows the change against last quarter's revenue instead of last month's.",
      },
      {
        prompt: mockupAsks.stat.rupees,
        result:
          "The comparison reads as an amount, such as +₹85,832, rather than a percentage.",
      },
      {
        prompt: mockupAsks.stat.overdue,
        result: "The card switches to the total value of overdue orders.",
      },
    ],
    rules: [
      "A card can show and compare only the metrics you list in `metrics`. Users can't write a new calculation into it.",
      "A comparison shows as a difference or a percentage. Whether a rise is good or bad comes from your `trend` setting, not the user.",
      "Formatting changes how the number reads, never the number itself.",
      "Stat cards in a region can also be moved, hidden or pinned like any other card, within the region's rules.",
    ],
    examples: [
      {
        title: "A row of key metrics",
        description:
          "Put stat cards in a region so users can reorder and hide them too.",
        code: `<PliantRegion
  id="key-metrics"
  slots={{
    revenue: <PliantStat id="revenue" metrics={metrics} metric="revenue" />,
    orders: <PliantStat id="orders" metrics={metrics} metric="orders" />,
    overdue: (
      <PliantStat
        id="overdue"
        metrics={metrics}
        metric="overdueValue"
        trend="down-is-good"
      />
    ),
  }}
  className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
/>`,
      },
    ],
    options: [
      {
        component: "PliantStat",
        props: [
          {
            name: "id",
            type: "string",
            description: "The card's node id, unique on its surface.",
          },
          {
            name: "metrics",
            type: "Record<string, { label: string; value: number; format?: Format }>",
            description: "Every metric the card may show or compare against.",
          },
          {
            name: "metric",
            type: "string",
            description: "The metric shown by default.",
          },
          {
            name: "comparison",
            type: '{ metric: string; display: "difference" | "percent" }',
            description:
              "The default comparison, such as last month's revenue as a percentage.",
          },
          {
            name: "format",
            type: "Format",
            description: "How the value shows by default.",
          },
          {
            name: "trend",
            type: '"up-is-good" | "down-is-good"',
            default: '"up-is-good"',
            description: "Which direction of change shows as good.",
          },
        ],
      },
    ],
    accessibility: [
      'The card reads as one group: its label, its value and its comparison, such as "Revenue, ₹4,821,000, up 12% on last month".',
      "Rises and falls are marked with an arrow and words, not color alone.",
      "When a user changes the metric, the new value is announced politely without moving focus.",
    ],
  },
  {
    slug: "list",
    registryItem: "pliant-list",
    dependencies: ["@pliantui/react", "lucide-react"],
    usage: {
      imports: `import { PliantList } from "@/components/pliant/pliant-list"`,
      code: `<PliantList
  id="recent-orders"
  data={orders}
  fields={ordersDataset.fields}
  sort={[{ field: "createdAt", dir: "desc" }]}
  renderItem={(order) => <OrderRow order={order} />}
/>`,
    },
    asks: [
      {
        prompt: mockupAsks.list.overdueSouth,
        result: "The list shows overdue orders from the South region only.",
      },
      {
        prompt: mockupAsks.list.group,
        result:
          "Orders gather under a heading for each customer, such as Kaveri Agro, with a count.",
      },
      {
        prompt: mockupAsks.list.compact,
        result: "Items sit closer together so more orders fit on screen.",
      },
    ],
    rules: [
      "Users sort, filter and group only by fields your dataset marks sortable, filterable or groupable.",
      "A filter narrows rows the list already has. It never shows a row your server didn't send.",
      "Filters last for the browser tab unless you save them with `persistFilters`.",
      "Density follows the page's density preference unless the user sets it on the list itself.",
    ],
    examples: [
      {
        title: "Grouped list",
        description:
          "Start grouped by status, so users see overdue orders at a glance.",
        code: `<PliantList
  id="orders-by-status"
  data={orders}
  fields={ordersDataset.fields}
  groupBy={["status"]}
  renderItem={(order) => (
    <div className="flex justify-between">
      <span>{order.customer}</span>
      <span>{inr.format(order.value)}</span>
    </div>
  )}
/>`,
      },
    ],
    options: [
      {
        component: "PliantList",
        props: [
          {
            name: "id",
            type: "string",
            description: "The list's node id, unique on its surface.",
          },
          {
            name: "data",
            type: "readonly TRow[]",
            description: "The rows to list.",
          },
          {
            name: "fields",
            type: "Record<string, FieldDefinition>",
            description:
              "Each field's type and what users may do with it, as in a dataset.",
          },
          {
            name: "renderItem",
            type: "(row: TRow) => ReactNode",
            description: "Renders one item.",
          },
          {
            name: "sort",
            type: "SortSpec[]",
            description: "The default sort.",
          },
          {
            name: "groupBy",
            type: "string[]",
            description: "The default grouping, up to four fields.",
          },
          {
            name: "density",
            type: '"compact" | "default" | "comfortable"',
            default: '"default"',
            description: "The default spacing between items.",
          },
          {
            name: "persistFilters",
            type: "boolean",
            default: "false",
            description:
              "Save filters with the user's other changes, not just for the tab.",
          },
        ],
      },
    ],
    accessibility: [
      "The list renders as a `ul` with one `li` per item, and groups as labelled sublists with their counts.",
      "Changing the sort or a filter announces the new item count.",
      "Keyboard focus moves through items in the order users see them, whatever the sort.",
    ],
  },
  {
    slug: "tabs-and-panels",
    registryItem: "pliant-tabs",
    dependencies: ["@pliantui/react", "radix-ui"],
    usage: {
      imports: `import { PliantTabs } from "@/components/pliant/pliant-tabs"`,
      code: `<PliantTabs
  id="customer-tabs"
  defaultValue="orders"
  tabs={{
    orders: { label: "Orders", content: <CustomerOrders /> },
    invoices: { label: "Invoices", content: <CustomerInvoices /> },
    notes: { label: "Notes", content: <CustomerNotes /> },
  }}
/>`,
    },
    asks: [
      {
        prompt: mockupAsks["tabs-and-panels"].openInvoices,
        result:
          "The Invoices tab is selected whenever this user opens a customer.",
      },
      {
        prompt: mockupAsks["tabs-and-panels"].notesFirst,
        result: "The Notes tab moves to the start of the tab list.",
      },
    ],
    rules: [
      "Users can hide a tab, but never the last visible one, and never one flagged `critical`.",
      "Tabs move only within their own tab list.",
      "The tab a user is on is not saved; only their choice of default tab is.",
      "A locked tab list keeps your order, default and visible tabs for everyone the lock covers.",
    ],
    examples: [
      {
        title: "Panels side by side",
        description:
          'With `orientation="vertical"`, tabs sit beside their panel, as on a settings page.',
        code: `<PliantTabs
  id="settings-tabs"
  orientation="vertical"
  defaultValue="profile"
  tabs={{
    profile: { label: "Profile", content: <ProfileForm /> },
    billing: { label: "Billing", content: <BillingForm /> },
    team: { label: "Team", content: <TeamMembers /> },
  }}
/>`,
      },
    ],
    options: [
      {
        component: "PliantTabs",
        props: [
          {
            name: "id",
            type: "string",
            description: "The tab list's node id, unique on its surface.",
          },
          {
            name: "tabs",
            type: "Record<string, { label: string; content: ReactNode }>",
            description:
              "Each tab by id. The order of the keys is your default order.",
          },
          {
            name: "defaultValue",
            type: "string",
            description: "The tab selected by default.",
          },
          {
            name: "orientation",
            type: '"horizontal" | "vertical"',
            default: '"horizontal"',
            description: "Whether tabs sit above or beside their panel.",
          },
          {
            name: "locked",
            type: "boolean",
            default: "false",
            description:
              "Keep the tabs as you wrote them. Users can't change them.",
          },
        ],
      },
    ],
    accessibility: [
      "Tabs follow the WAI-ARIA tabs pattern: arrow keys move between tabs, and Home and End jump to the first and last.",
      "When a user reorders tabs, the keyboard order follows the new visible order.",
      "Hidden tabs are removed from the tab list, not just made invisible, so screen readers don't announce them.",
    ],
  },
  {
    slug: "actions",
    registryItem: "pliant-actions",
    dependencies: ["@pliantui/react", "lucide-react", "radix-ui"],
    usage: {
      imports: `import { PliantActions } from "@/components/pliant/pliant-actions"`,
      code: `<PliantActions
  id="order-actions"
  actions={{
    save: { label: "Save", onSelect: save },
    invoice: { label: "Send GST invoice", onSelect: sendInvoice },
    export: { label: "Export", onSelect: exportOrder, overflow: true },
    delete: { label: "Delete", onSelect: remove, overflow: true },
  }}
/>`,
    },
    asks: [
      {
        prompt: mockupAsks.actions.bindExport,
        result:
          "Pressing ⌘⇧E (Ctrl+Shift+E on Windows and Linux) runs Export, and the shortcut shows next to it in the menu.",
      },
      {
        prompt: mockupAsks.actions.exportToToolbar,
        result: "Export moves out of the overflow menu and onto the toolbar.",
      },
    ],
    rules: [
      "An action flagged `destructive`, such as Delete, can never move closer to the `primary` action, such as Save, and its style can't change.",
      "A shortcut can't take keys the browser, the operating system or a screen reader relies on, keys another action has, or your `reservedShortcuts`.",
      "An action flagged `critical` can't be hidden.",
      "Users change where an action sits and how they reach it, never what it does.",
    ],
    examples: [
      {
        title: "Flag Save and Delete",
        description:
          "Mark the primary and destructive actions in `pliant.config.ts`, and reserve your app's own shortcuts.",
        code: `export default defineConfig({
  reservedShortcuts: ["mod+k", "mod+s"],
  flags: {
    "/orders/[id]": {
      "order-actions/actions/save": { primary: true },
      "order-actions/actions/delete": { destructive: true },
    },
  },
})`,
      },
      {
        title: "A default shortcut",
        description: "Give an action a shortcut users can rebind.",
        code: `<PliantActions
  id="order-actions"
  actions={{
    save: { label: "Save", onSelect: save, shortcut: "mod+enter" },
    invoice: { label: "Send GST invoice", onSelect: sendInvoice },
  }}
/>`,
      },
    ],
    options: [
      {
        component: "PliantActions",
        props: [
          {
            name: "id",
            type: "string",
            description: "The toolbar's node id, unique on its surface.",
          },
          {
            name: "actions",
            type: "Record<string, PliantAction>",
            description:
              "Each action by id. The order of the keys is your default order.",
          },
          {
            name: "overflowLabel",
            type: "string",
            default: '"More actions"',
            description: "The accessible name of the overflow menu button.",
          },
        ],
      },
      {
        component: "PliantAction",
        props: [
          { name: "label", type: "string", description: "The action's name." },
          {
            name: "onSelect",
            type: "() => void",
            description: "Runs the action.",
          },
          {
            name: "icon",
            type: "LucideIcon",
            description: "An icon shown before the label.",
          },
          {
            name: "overflow",
            type: "boolean",
            default: "false",
            description: "Start the action in the overflow menu.",
          },
          {
            name: "shortcut",
            type: "string",
            description:
              "A default shortcut, such as `mod+enter`. `mod` is ⌘ on a Mac and Ctrl elsewhere.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description: "Disable the action.",
          },
        ],
      },
    ],
    accessibility: [
      "The toolbar follows the WAI-ARIA toolbar pattern, with arrow keys moving between actions and one tab stop for the group.",
      "A bound shortcut is announced with the action, through `aria-keyshortcuts`, and shown in its menu.",
      "Moving an action moves the element itself, so keyboard and screen reader order match what users see.",
    ],
  },
  {
    slug: "dialog",
    registryItem: "pliant-dialog",
    dependencies: ["@pliantui/react", "radix-ui", "vaul"],
    usage: {
      imports: `import { PliantDialog } from "@/components/pliant/pliant-dialog"`,
      code: `<PliantDialog
  id="new-order"
  title="New order"
  trigger={<Button>New order</Button>}
>
  <NewOrderForm />
</PliantDialog>`,
    },
    asks: [
      {
        prompt: mockupAsks.dialog.sheet,
        result:
          "New order slides in from the side of the screen instead of opening in the middle.",
      },
      {
        prompt: mockupAsks.dialog.bigger,
        result:
          "The dialog opens at the large size, with room for the order's line items.",
      },
      {
        prompt: mockupAsks.dialog.drawer,
        result:
          "New order opens as a drawer that rises from the bottom of the screen.",
      },
      {
        prompt: mockupAsks.dialog.foldNotes,
        result:
          "The Delivery notes field moves into the form's More fields section.",
      },
    ],
    rules: [
      "Users choose among dialog, sheet, drawer and page, unless you narrow it with `presentations`.",
      "Fields follow the form's rules: required fields always stay visible, and fields never leave their form.",
      "A sheet or drawer side is stored as start or end, so it flips with right-to-left languages.",
      "A dialog that confirms something destructive should set `locked`, so it always opens as you wrote it.",
    ],
    examples: [
      {
        title: "Start as a sheet",
        description:
          "Open on the end side by default, and let users pick a size.",
        code: `<PliantDialog
  id="order-details"
  title="Order ORD-1042"
  presentation="sheet"
  side="end"
  size="lg"
  presentations={["sheet", "dialog", "page"]}
  trigger={<Button variant="outline">Details</Button>}
>
  <OrderDetails orderId="ORD-1042" />
</PliantDialog>`,
      },
    ],
    options: [
      {
        component: "PliantDialog",
        props: [
          {
            name: "id",
            type: "string",
            description: "The dialog's node id, unique on its surface.",
          },
          {
            name: "title",
            type: "string",
            description: "The dialog's heading and accessible name.",
          },
          {
            name: "description",
            type: "string",
            description: "A short line under the title.",
          },
          {
            name: "trigger",
            type: "ReactNode",
            description: "The element that opens it.",
          },
          {
            name: "presentation",
            type: '"dialog" | "sheet" | "drawer" | "page"',
            default: '"dialog"',
            description: "How it opens by default.",
          },
          {
            name: "side",
            type: '"top" | "end" | "bottom" | "start"',
            default: '"end"',
            description: "Where a sheet or drawer comes from.",
          },
          {
            name: "size",
            type: '"sm" | "md" | "lg" | "xl" | "full"',
            default: '"md"',
            description: "The default size.",
          },
          {
            name: "presentations",
            type: "Presentation[]",
            description:
              "The presentations users may switch to. All four by default.",
          },
          {
            name: "open",
            type: "boolean",
            description: "The open state, when you control it.",
          },
          {
            name: "onOpenChange",
            type: "(open: boolean) => void",
            description: "Called when it opens or closes.",
          },
          {
            name: "locked",
            type: "boolean",
            default: "false",
            description: "Keep it as you wrote it. Users can't change it.",
          },
        ],
      },
    ],
    accessibility: [
      "Every presentation traps focus while open, closes on Escape, and returns focus to the trigger.",
      "The title is the accessible name in every presentation, so switching from a dialog to a sheet doesn't change what screen readers announce.",
      "Drawers open and close without animation for users who prefer reduced motion.",
    ],
  },
  {
    slug: "suggestions",
    registryItem: "pliant-suggestions",
    dependencies: ["@pliantui/react"],
    usage: {
      imports: `import { PliantSuggestions } from "@/components/pliant/pliant-suggestions"`,
      code: `<PliantSuggestions
  targets={askTargets}
  target="orders-table"
  onPick={(prompt) => openAskPanel(prompt)}
/>`,
    },
    asks: [
      {
        prompt: mockupAsks.suggestions.overdue,
        result:
          "Picking the chip fills in the ask panel; the table filters to overdue orders as a preview.",
      },
      {
        prompt: mockupAsks.suggestions.highlight,
        result:
          "The overdue orders worth more than ₹1,00,000 are highlighted until the user locks it in.",
      },
    ],
    rules: [
      "Suggestions come from each target's `suggestions`, so users see only asks you wrote or approved.",
      "A suggestion only fills in the ask panel. Nothing changes until the user sends it, and nothing is saved until they lock it in.",
      "Suggestions for a part the user can't change, because it's locked, aren't shown.",
      "Once a suggestion's change is already in place, it's left out.",
    ],
    examples: [
      {
        title: "Suggestions in an empty ask panel",
        description: "Show three suggestions for the part the user pointed at.",
        code: `<PliantSuggestions
  targets={askTargets}
  target={target}
  max={3}
  onPick={(prompt) => {
    setPrompt(prompt)
    setOpen(true)
  }}
/>`,
      },
    ],
    options: [
      {
        component: "PliantSuggestions",
        props: [
          {
            name: "targets",
            type: "PliantAskTarget[]",
            description: "The same targets you give the ask panel.",
          },
          {
            name: "target",
            type: "string",
            description:
              "The part to suggest asks for. Leave it out to mix suggestions from every target.",
          },
          {
            name: "onPick",
            type: "(prompt: string, target: string) => void",
            description: "Called with the picked ask.",
          },
          {
            name: "max",
            type: "number",
            default: "3",
            description: "The most chips to show.",
          },
        ],
      },
    ],
    accessibility: [
      "Suggestions render as a labelled group of buttons, and each one's text is the ask it fills in.",
      "Picking a suggestion moves focus to the ask panel's prompt, so the user can edit it before sending.",
      "Chips wrap onto new lines rather than scrolling sideways, so none are hidden at large text sizes.",
    ],
  },
  {
    slug: "customized-indicator",
    registryItem: "pliant-customized-indicator",
    dependencies: ["@pliantui/react", "lucide-react", "radix-ui"],
    usage: {
      imports: `import { PliantCustomizedIndicator } from "@/components/pliant/pliant-customized-indicator"`,
      code: `<div className="flex items-center gap-2">
  <h2 className="text-lg font-semibold">All orders</h2>
  <PliantCustomizedIndicator node="orders-table" />
</div>`,
    },
    asks: [
      {
        prompt: mockupAsks["customized-indicator"].list,
        result:
          'The indicator\'s list opens, showing each change, such as "Sorted by value, highest first".',
      },
      {
        prompt: mockupAsks["customized-indicator"].undo,
        result:
          "The user's own changes to the orders table are dropped, and the indicator shows only the team's.",
      },
      {
        prompt: mockupAsks["customized-indicator"].who,
        result:
          "The list shows which changes came from the Sales North team default and which are the user's own.",
      },
    ],
    rules: [
      "The indicator shows changes from every layer, but Reset drops only the user's own personal and session changes.",
      "Changes from a team or organization default are listed with their source, and members can adjust but not remove them.",
      "A preview from the ask panel shows separately, and isn't counted until the user locks it in.",
      "When nothing is changed, the indicator renders nothing.",
    ],
    examples: [
      {
        title: "On every card in a region",
        description:
          "Show which metric cards differ from your page, next to each card's title.",
        code: `<StatCard
  title={
    <>
      Overdue
      <PliantCustomizedIndicator node="key-metrics/slots/overdue" />
    </>
  }
  value="17"
/>`,
      },
    ],
    options: [
      {
        component: "PliantCustomizedIndicator",
        props: [
          {
            name: "node",
            type: "string",
            description: "The address of the part to watch.",
          },
          {
            name: "layers",
            type: '("team" | "org" | "personal" | "session")[]',
            description:
              "Which layers' changes to show. All of them by default.",
          },
          {
            name: "showReset",
            type: "boolean",
            default: "true",
            description: "Show a Reset button in the list of changes.",
          },
        ],
      },
    ],
    accessibility: [
      'The marker is a button named "Customized, 3 changes", so it isn\'t announced as a bare dot.',
      "Its list opens in a popover that keyboard users reach with Tab and close with Escape.",
      "The marker uses an icon and a text label, not color alone.",
    ],
  },
  {
    slug: "reset",
    registryItem: "pliant-reset",
    dependencies: ["@pliantui/react", "lucide-react"],
    usage: {
      imports: `import { PliantReset } from "@/components/pliant/pliant-reset"`,
      code: `<PliantReset node="orders-table" />`,
    },
    asks: [
      {
        prompt: mockupAsks.reset.table,
        result:
          "The user's sort, filters, hidden columns and widths on the orders table are dropped.",
      },
      {
        prompt: mockupAsks.reset.page,
        result:
          "Every change the user made to the orders page is dropped, after they confirm.",
      },
      {
        prompt: mockupAsks.reset.metrics,
        result:
          "The key metrics show in the order and layout of the team default, or of your page.",
      },
    ],
    rules: [
      "Reset drops only the user's own personal and session changes. Team and organization defaults stay, so a member returns to the team's default, not your original page.",
      "Resetting a part leaves where that part sits on the page, which belongs to its container.",
      "Resetting the whole page asks for confirmation first, and Undo brings the changes back.",
      "Reset needs storage that can remove a change. Without it, the button is disabled.",
    ],
    examples: [
      {
        title: "Reset the whole page",
        description: "Put a page-wide reset in a settings menu.",
        code: `<DropdownMenuContent>
  <DropdownMenuItem asChild>
    <PliantReset scope="surface" variant="ghost">
      Reset this page
    </PliantReset>
  </DropdownMenuItem>
</DropdownMenuContent>`,
      },
      {
        title: "Reset from your own code",
        description:
          "Call `resetNode` from the store, and show its error if it's rejected.",
        code: `const { resetNode } = usePliantStore()

function onReset() {
  const result = resetNode("key-metrics")
  if (!result.success) toast.error(result.error)
}`,
      },
    ],
    options: [
      {
        component: "PliantReset",
        props: [
          {
            name: "node",
            type: "string",
            description:
              'The address of the part to reset. Required unless `scope` is `"surface"`.',
          },
          {
            name: "scope",
            type: '"node" | "surface"',
            default: '"node"',
            description: "Reset one part, or every change on the surface.",
          },
          {
            name: "confirm",
            type: "boolean",
            default: "true for a surface, false for a node",
            description: "Ask before resetting.",
          },
          {
            name: "variant",
            type: 'ButtonProps["variant"]',
            default: '"outline"',
            description: "The button's style.",
          },
          {
            name: "children",
            type: "ReactNode",
            default: '"Reset"',
            description: "The button's label.",
          },
          {
            name: "onReset",
            type: "(result: ResetNodeResult) => void",
            description: "Called after a reset, with whether it succeeded.",
          },
        ],
      },
    ],
    accessibility: [
      "The button is disabled, with a reason in its tooltip, while there's nothing to reset.",
      'After a reset, the change is announced, such as "Orders table reset", and focus stays on the button.',
      "The confirmation is an alert dialog that focuses Cancel first.",
    ],
  },
  {
    slug: "history-and-undo",
    registryItem: "pliant-history",
    dependencies: ["@pliantui/react", "lucide-react", "radix-ui"],
    usage: {
      imports: `import { PliantHistory, PliantUndoButtons } from "@/components/pliant/pliant-history"`,
      code: `<div className="flex items-center gap-1">
  <PliantUndoButtons />
  <PliantHistory />
</div>`,
    },
    asks: [
      {
        prompt: mockupAsks["history-and-undo"].undo,
        result: "The last change is undone, as if the user pressed ⌘ Z.",
      },
      {
        prompt: mockupAsks["history-and-undo"].morning,
        result:
          "The page returns to the point in the history from this morning, and later changes can be redone.",
      },
      {
        prompt: mockupAsks["history-and-undo"].today,
        result:
          'The history panel opens on today\'s changes, such as "Hid the notes column".',
      },
    ],
    rules: [
      "Undo covers the user's own changes on this page, including ones they locked in from the ask panel.",
      "Team defaults and changes from other devices aren't undone, though they show in the history so the timeline makes sense.",
      "A page number never enters the history, since it's never saved.",
      "Going back to an earlier point is itself a change, so the user can undo it.",
    ],
    examples: [
      {
        title: "Undo from your own code",
        description: "Read and drive the history with `usePliantHistory`.",
        code: `const { canUndo, undo, entries } = usePliantHistory()

return (
  <Button variant="ghost" disabled={!canUndo} onClick={undo}>
    Undo {entries.at(-1)?.description}
  </Button>
)`,
      },
    ],
    options: [
      {
        component: "PliantUndoButtons",
        props: [
          {
            name: "shortcuts",
            type: "boolean",
            default: "true",
            description:
              "Listen for ⌘ Z and ⌘ Shift Z (Ctrl Z and Ctrl Shift Z on Windows and Linux).",
          },
        ],
      },
      {
        component: "PliantHistory",
        props: [
          {
            name: "side",
            type: '"start" | "end"',
            default: '"end"',
            description: "Which side the history panel opens on.",
          },
          {
            name: "limit",
            type: "number",
            default: "100",
            description: "The most changes to list.",
          },
        ],
      },
      {
        component: "usePliantHistory",
        props: [
          {
            name: "entries",
            type: "{ id: string; description: string; at: string; layer: Layer }[]",
            description: "Each change, oldest first, with a short description.",
          },
          {
            name: "undo",
            type: "() => void",
            description: "Undoes the last change.",
          },
          {
            name: "redo",
            type: "() => void",
            description: "Redoes the last undone change.",
          },
          {
            name: "goTo",
            type: "(id: string) => void",
            description: "Returns the page to the point after that change.",
          },
          {
            name: "canUndo",
            type: "boolean",
            description: "Whether there's a change to undo.",
          },
          {
            name: "canRedo",
            type: "boolean",
            description: "Whether there's a change to redo.",
          },
        ],
      },
    ],
    accessibility: [
      'Undo and redo announce what they changed, such as "Undid: sorted by value, highest first".',
      "The history panel is a list of buttons, one per change, read newest first.",
      "The keyboard shortcuts don't fire while focus is in a text field, so they don't steal the field's own undo.",
    ],
  },
  {
    slug: "share-link",
    registryItem: "pliant-share-link",
    dependencies: ["@pliantui/react", "lucide-react"],
    usage: {
      imports: `import { PliantShareLink, PliantSharedView } from "@/components/pliant/pliant-share-link"`,
      code: `<PliantRoot surface="/orders" storage={storage}>
  <PliantSharedView />
  <PliantShareLink />
  <OrdersTable />
</PliantRoot>`,
    },
    asks: [
      {
        prompt: mockupAsks["share-link"].kavya,
        result:
          "A link to the page with the current arrangement is copied, ready to send to Kavya Reddy.",
      },
      {
        prompt: mockupAsks["share-link"].tableOnly,
        result:
          "The copied link carries only the orders table's changes, not the rest of the page.",
      },
      {
        prompt: mockupAsks["share-link"].keep,
        result:
          "On the receiving end, the previewed arrangement is saved as the colleague's own.",
      },
    ],
    rules: [
      "A link carries only changes, never data. A colleague who opens it sees only rows they're allowed to see.",
      "Opening a link never changes the page without asking: it shows as a preview with Keep and Discard.",
      "Changes the colleague's page doesn't allow, such as on a part locked for their team, are left out of the preview.",
      'Kept changes are saved with `source: "share"`, so you can tell them apart in storage.',
    ],
    examples: [
      {
        title: "Share one part",
        description: "Limit the link to the orders table's changes.",
        code: `<PliantShareLink node="orders-table" variant="ghost" size="sm">
  Share table view
</PliantShareLink>`,
      },
    ],
    options: [
      {
        component: "PliantShareLink",
        props: [
          {
            name: "node",
            type: "string",
            description:
              "Share only this part's changes. The whole surface by default.",
          },
          {
            name: "onCopy",
            type: "(url: string) => void",
            description: "Called with the link, after it's copied.",
          },
          {
            name: "children",
            type: "ReactNode",
            default: '"Share view"',
            description: "The button's label.",
          },
        ],
      },
      {
        component: "PliantSharedView",
        props: [
          {
            name: "onKeep",
            type: "() => void",
            description: "Called after the colleague keeps the shared view.",
          },
          {
            name: "onDiscard",
            type: "() => void",
            description: "Called after they discard it.",
          },
        ],
      },
    ],
    accessibility: [
      'Copying the link is announced, such as "Link copied", without moving focus.',
      "The shared view bar is a labelled region at the top of the page, and Keep and Discard are reachable with Tab.",
      'The preview is described in words, such as "Sorted by value, notes column hidden", not only shown on the page.',
    ],
  },
  {
    slug: "team-publish",
    registryItem: "pliant-team-publish",
    dependencies: ["@pliantui/react", "lucide-react", "radix-ui"],
    usage: {
      imports: `import { PliantTeamPublish } from "@/components/pliant/pliant-team-publish"`,
      code: `<PliantTeamPublish team="sales-north" />`,
    },
    asks: [
      {
        prompt: mockupAsks["team-publish"].team,
        result:
          "A preview shows what Sales North will see; after confirming, it's the team's default.",
      },
      {
        prompt: mockupAsks["team-publish"].everyone,
        result:
          "For an admin, the arrangement is published as the organization's default after a preview.",
      },
      {
        prompt: mockupAsks["team-publish"].remove,
        result:
          "The team's default is removed, and members go back to the organization's default or your page.",
      },
    ],
    rules: [
      "Publishing needs server storage, and your storage route's `canPublish` decides who may publish for a team or the whole organization.",
      "Members still win on anything they changed themselves, and Reset brings them back to the team's default.",
      "Publishing again replaces the team's default rather than adding to it.",
      "A default is a starting point, not a lock. To stop members changing a part, lock it.",
    ],
    examples: [
      {
        title: "Several teams",
        description:
          "For a user on more than one team, list the teams they may publish for, and rank them on `PliantRoot`.",
        code: `<PliantRoot
  surface="/orders"
  storage={storage}
  teamOrder={["sales-north", "sales"]}
>
  <PliantTeamPublish
    teams={[
      { id: "sales-north", label: "Sales North" },
      { id: "sales", label: "Sales" },
    ]}
  />
</PliantRoot>`,
      },
    ],
    options: [
      {
        component: "PliantTeamPublish",
        props: [
          {
            name: "team",
            type: "string",
            description: "The team to publish for, when the user has one.",
          },
          {
            name: "teams",
            type: "{ id: string; label: string }[]",
            description:
              "The teams to choose from, when the user is on several.",
          },
          {
            name: "org",
            type: "boolean",
            default: "false",
            description:
              "Also offer Publish for everyone. Show it only to admins; the server checks again.",
          },
          {
            name: "onPublish",
            type: '(target: { layer: "team" | "org"; team?: string }) => void',
            description: "Called after a default is published.",
          },
          {
            name: "onRemove",
            type: '(target: { layer: "team" | "org"; team?: string }) => void',
            description: "Called after a default is removed.",
          },
        ],
      },
    ],
    accessibility: [
      "The preview opens in a dialog that names the team and lists the changes in words.",
      "Publish and Remove team default are announced with the team they apply to.",
      "If the server refuses, the reason is shown in the dialog and focus moves to it.",
    ],
  },
  {
    slug: "text-size-density-motion",
    registryItem: "pliant-preferences",
    dependencies: ["@pliantui/react", "radix-ui"],
    usage: {
      imports: `import { PliantPreferences } from "@/components/pliant/pliant-preferences"`,
      code: `<PliantPreferences />`,
    },
    asks: [
      {
        prompt: mockupAsks["text-size-density-motion"].bigger,
        result: "Text across the app grows a step, and layouts reflow to fit.",
      },
      {
        prompt: mockupAsks["text-size-density-motion"].compact,
        result: "Rows, cards and lists on the orders page sit closer together.",
      },
      {
        prompt: mockupAsks["text-size-density-motion"].still,
        result:
          "Motion is reduced across the app: menus, sheets and placeholders appear without animating.",
      },
    ],
    rules: [
      "Text size is one of 100%, 112.5%, 125% or 150%, and applies to the whole app.",
      "Density is compact, default or comfortable, and applies to the page it's set on.",
      "Motion is full or reduced. When the user's system asks for reduced motion, Pliant follows it whatever this setting says.",
      "These are personal preferences, so team defaults can set a starting density but each user's own choice wins.",
    ],
    examples: [
      {
        title: "Only density",
        description: "Show just the density control in a table toolbar.",
        code: `<PliantPreferences controls={["density"]} />`,
      },
      {
        title: "Style for density",
        description:
          "Pliant sets `data-density` on the page's root, so your own components can follow it.",
        code: `<div className="p-4 in-data-[density=compact]:p-2 in-data-[density=comfortable]:p-6">
  <OrderSummary />
</div>`,
      },
    ],
    options: [
      {
        component: "PliantPreferences",
        props: [
          {
            name: "controls",
            type: '("textSize" | "density" | "motion")[]',
            default: '["textSize", "density", "motion"]',
            description: "Which controls to show.",
          },
          {
            name: "variant",
            type: '"menu" | "inline"',
            default: '"menu"',
            description:
              "Show the controls in a dropdown menu or inline, as on a settings page.",
          },
        ],
      },
    ],
    accessibility: [
      "Text size scales the root font size, so every size set in `rem`, including shadcn/ui's, grows with it.",
      "Each control is a labelled radio group, operable with arrow keys.",
      "Reduced motion sets `data-motion=\"reduced\"` on `<html>`, and Pliant's components stop animating when it's set.",
    ],
  },
]
