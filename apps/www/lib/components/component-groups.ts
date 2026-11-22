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
}

// The components with hand-written pages, in the order the index lists them.
export const componentPages: ComponentEntry[] = [
  { slug: "pliant-root", title: "PliantRoot", group: "Core" },
  { slug: "region", title: "Region", group: "Core" },
  { slug: "pre-paint", title: "Pre-paint", group: "Core" },
  { slug: "data-table", title: "Data Table", group: "Data" },
  { slug: "form", title: "Form", group: "Forms" },
  { slug: "nav", title: "Nav", group: "Navigation" },
  { slug: "ask-panel", title: "Ask Panel", group: "AI" },
  { slug: "point-mode", title: "Point Mode", group: "AI" },
]
