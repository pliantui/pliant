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

// The group each component page is listed under on the components index.
// The pages' order and titles come from the docs' `meta.json` and their
// front matter.
export const componentGroupOf: Record<string, ComponentGroup> = {
  "pliant-root": "Core",
  region: "Core",
  "pre-paint": "Core",
  messages: "Core",
  "data-table": "Data",
  chart: "Data",
  stat: "Data",
  list: "Data",
  form: "Forms",
  nav: "Navigation",
  "tabs-and-panels": "Navigation",
  actions: "Actions",
  dialog: "Overlays",
  "ask-panel": "AI",
  "point-mode": "AI",
  suggestions: "AI",
  "customized-indicator": "Status and history",
  reset: "Status and history",
  "history-and-undo": "Status and history",
  "share-link": "Status and history",
  "team-publish": "Status and history",
  "text-size-density-motion": "Preferences",
}
