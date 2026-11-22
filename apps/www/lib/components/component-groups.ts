export const componentGroups = [
  "Core",
  "Data",
  "Forms",
  "Navigation",
  "Actions",
  "Overlays",
  "AI",
  "Status and history",
  "Preferences",
] as const

type ComponentGroup = (typeof componentGroups)[number]

interface ComponentEntry {
  slug: string
  title: string
  group: ComponentGroup
  // Whether the component is in Pliant yet. Pages for the others share one
  // template, filled from `mockup-pages.ts`.
  built: boolean
}

// Every component page, in the order the index and the sidebar list them.
export const componentPages: ComponentEntry[] = [
  { slug: "pliant-root", title: "PliantRoot", group: "Core", built: true },
  { slug: "region", title: "Region", group: "Core", built: true },
  { slug: "pre-paint", title: "Pre-paint", group: "Core", built: true },
  { slug: "messages", title: "Messages", group: "Core", built: false },
  { slug: "data-table", title: "Data Table", group: "Data", built: true },
  { slug: "chart", title: "Chart", group: "Data", built: false },
  { slug: "stat", title: "Stat", group: "Data", built: false },
  { slug: "list", title: "List", group: "Data", built: false },
  { slug: "form", title: "Form", group: "Forms", built: true },
  { slug: "nav", title: "Nav", group: "Navigation", built: true },
  {
    slug: "tabs-and-panels",
    title: "Tabs and Panels",
    group: "Navigation",
    built: false,
  },
  { slug: "actions", title: "Actions", group: "Actions", built: false },
  { slug: "dialog", title: "Dialog", group: "Overlays", built: false },
  { slug: "ask-panel", title: "Ask Panel", group: "AI", built: true },
  { slug: "point-mode", title: "Point Mode", group: "AI", built: true },
  { slug: "suggestions", title: "Suggestions", group: "AI", built: false },
  {
    slug: "customized-indicator",
    title: "Customized Indicator",
    group: "Status and history",
    built: false,
  },
  { slug: "reset", title: "Reset", group: "Status and history", built: false },
  {
    slug: "history-and-undo",
    title: "History and Undo",
    group: "Status and history",
    built: false,
  },
  {
    slug: "share-link",
    title: "Share Link",
    group: "Status and history",
    built: false,
  },
  {
    slug: "team-publish",
    title: "Team Publish",
    group: "Status and history",
    built: false,
  },
  {
    slug: "text-size-density-motion",
    title: "Text Size, Density and Motion",
    group: "Preferences",
    built: false,
  },
]
