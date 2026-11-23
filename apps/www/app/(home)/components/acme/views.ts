// The pages of the Acme dashboard, which its sidebar switches between.
export const mainViews = {
  dashboard: "Dashboard",
  lifecycle: "Lifecycle",
  analytics: "Analytics",
  projects: "Projects",
  team: "Team",
} as const

const otherViews = {
  "data-library": "Data Library",
  reports: "Reports",
  "word-assistant": "Word Assistant",
  "proposal-templates": "Proposal Templates",
  "brand-guide": "Brand Guide",
  settings: "Settings",
  help: "Get Help",
  search: "Search",
  inbox: "Inbox",
  "quick-create": "Quick Create",
} as const

export type MainView = keyof typeof mainViews
export type View = MainView | keyof typeof otherViews

export function isMainView(value: string): value is MainView {
  return Object.hasOwn(mainViews, value)
}

export function viewTitle(view: View) {
  return isMainView(view) ? mainViews[view] : otherViews[view]
}
