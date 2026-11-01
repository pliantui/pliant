import type { Capability } from "./capability"
import type { Layer } from "./layer"
import type { OpName } from "./op"

export interface OpDefinition {
  capability: Capability | null
  appliesTo: "target" | "parent" | "surface" | "app"
  layers: readonly Layer[]
}

const anyLayer = ["org", "team", "personal", "session"] as const

export const opCatalog = {
  setProp: { capability: "props", appliesTo: "target", layers: anyLayer },
  rename: { capability: "label", appliesTo: "target", layers: anyLayer },
  hide: { capability: "hideable", appliesTo: "target", layers: anyLayer },
  show: { capability: "hideable", appliesTo: "target", layers: anyLayer },
  move: { capability: "slots", appliesTo: "parent", layers: anyLayer },
  collapse: { capability: "slots", appliesTo: "target", layers: anyLayer },
  pin: { capability: "slots", appliesTo: "parent", layers: anyLayer },
  setLayout: { capability: "layout", appliesTo: "target", layers: anyLayer },
  span: { capability: "layout", appliesTo: "parent", layers: anyLayer },
  insert: { capability: "insertable", appliesTo: "target", layers: anyLayer },
  wrap: { capability: "insertable", appliesTo: "target", layers: anyLayer },
  remove: { capability: "insertable", appliesTo: "parent", layers: anyLayer },
  setDefault: { capability: "form", appliesTo: "parent", layers: anyLayer },
  setPresentation: {
    capability: "presentation",
    appliesTo: "target",
    layers: anyLayer,
  },
  setSize: {
    capability: "presentation",
    appliesTo: "target",
    layers: anyLayer,
  },
  setLanding: { capability: "nav", appliesTo: "parent", layers: anyLayer },
  promote: { capability: "actions", appliesTo: "parent", layers: anyLayer },
  demote: { capability: "actions", appliesTo: "parent", layers: anyLayer },
  bindShortcut: {
    capability: "actions",
    appliesTo: "parent",
    layers: anyLayer,
  },
  setSort: { capability: "data", appliesTo: "target", layers: anyLayer },
  setFilter: { capability: "data", appliesTo: "target", layers: anyLayer },
  clearFilter: { capability: "data", appliesTo: "target", layers: anyLayer },
  setPage: { capability: "data", appliesTo: "target", layers: ["session"] },
  setGroupBy: { capability: "data", appliesTo: "target", layers: anyLayer },
  addDerived: { capability: "data", appliesTo: "target", layers: anyLayer },
  addAggregate: { capability: "data", appliesTo: "target", layers: anyLayer },
  formatField: { capability: "data", appliesTo: "target", layers: anyLayer },
  addHighlight: { capability: "data", appliesTo: "target", layers: anyLayer },
  addSortOption: { capability: "data", appliesTo: "target", layers: anyLayer },
  addFilterControl: {
    capability: "data",
    appliesTo: "target",
    layers: anyLayer,
  },
  addPreset: { capability: "data", appliesTo: "target", layers: anyLayer },
  setViewKind: { capability: "data", appliesTo: "target", layers: anyLayer },
  configureChart: { capability: "data", appliesTo: "target", layers: anyLayer },
  configureStat: { capability: "data", appliesTo: "target", layers: anyLayer },
  removeUserItem: { capability: "data", appliesTo: "target", layers: anyLayer },
  setColumnWidth: { capability: "data", appliesTo: "parent", layers: anyLayer },
  setDensity: { capability: null, appliesTo: "surface", layers: anyLayer },
  setTextScale: { capability: null, appliesTo: "app", layers: anyLayer },
  setMotion: { capability: null, appliesTo: "app", layers: anyLayer },
} as const satisfies Record<OpName, OpDefinition>
