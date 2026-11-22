import { mockupPages } from "@/lib/components/mockup-pages"

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

export type ComponentGroup = (typeof componentGroups)[number]

interface ComponentEntry {
  slug: string
  title: string
  group: ComponentGroup
}

// The components with hand-written pages.
const builtPages: ComponentEntry[] = [
  { slug: "pliant-root", title: "PliantRoot", group: "Core" },
  { slug: "region", title: "Region", group: "Core" },
  { slug: "pre-paint", title: "Pre-paint", group: "Core" },
  { slug: "data-table", title: "Data Table", group: "Data" },
  { slug: "form", title: "Form", group: "Forms" },
  { slug: "nav", title: "Nav", group: "Navigation" },
  { slug: "ask-panel", title: "Ask Panel", group: "AI" },
  { slug: "point-mode", title: "Point Mode", group: "AI" },
]

// Every component page, by group: the built ones first, then the ones that
// aren't built yet, which share one template.
export const componentPages: ComponentEntry[] = componentGroups.flatMap(
  (group) => [
    ...builtPages.filter((page) => page.group === group),
    ...mockupPages
      .filter((page) => page.group === group)
      .map(({ slug, title }) => ({ slug, title, group })),
  ]
)
