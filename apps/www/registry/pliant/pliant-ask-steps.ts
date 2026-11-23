import type { OpName } from "@pliantui/contract"

/** A short label for each op, as the ask chat's steps name it. */
const pliantAskOpLabels = {
  setProp: "Set property",
  rename: "Rename",
  hide: "Hide",
  show: "Show",
  move: "Move",
  collapse: "Collapse into group",
  pin: "Pin",
  setLayout: "Change layout",
  span: "Span columns",
  insert: "Insert item",
  wrap: "Wrap in group",
  remove: "Remove item",
  setDefault: "Set default value",
  setPresentation: "Change presentation",
  setSize: "Change size",
  setLanding: "Set landing page",
  promote: "Promote action",
  demote: "Demote action",
  bindShortcut: "Bind shortcut",
  setSort: "Sort",
  setFilter: "Filter",
  clearFilter: "Clear filter",
  setPage: "Change page",
  setGroupBy: "Group rows",
  addDerived: "Add column",
  addAggregate: "Add total",
  formatField: "Format field",
  addHighlight: "Highlight rows",
  addSortOption: "Add sort option",
  addFilterControl: "Add filter",
  addPreset: "Add preset",
  setViewKind: "Change view",
  configureChart: "Configure chart",
  configureStat: "Configure stat",
  removeUserItem: "Remove added item",
  setColumnWidth: "Set column width",
  setDensity: "Change density",
  setTextScale: "Change text size",
  setMotion: "Change motion",
} as const satisfies Record<OpName, string>

function isOpName(name: string): name is OpName {
  return Object.hasOwn(pliantAskOpLabels, name)
}

/**
 * The ops an answer chose, in order and once each, from the overlay's op
 * names. Names that aren't ops are left out.
 */
function pliantAskChosenOps(names: readonly string[]): OpName[] {
  return [...new Set(names)].filter(isOpName)
}

export { pliantAskChosenOps, pliantAskOpLabels }
