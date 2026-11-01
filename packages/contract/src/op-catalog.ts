import type { Capability } from "./capability"
import type { Layer } from "./layer"
import type { OpName } from "./op"

export interface OpDefinition {
  capability: Capability | null
  appliesTo: "target" | "parent" | "surface" | "app"
  layers: readonly Layer[]
  /**
   * The op's argument keys, without `op` and `target`: one list per shape,
   * in no particular order. An op with keys outside every list comes from a
   * newer version when it is valid without them, using the shape that leaves
   * the fewest extra keys.
   */
  args: readonly (readonly string[])[]
}

const anyLayer = ["org", "team", "personal", "session"] as const

export const opCatalog: Readonly<Record<OpName, OpDefinition>> = {
  setProp: {
    capability: "props",
    appliesTo: "target",
    layers: anyLayer,
    args: [["prop", "value"]],
  },
  rename: {
    capability: "label",
    appliesTo: "target",
    layers: anyLayer,
    args: [["label"]],
  },
  hide: {
    capability: "hideable",
    appliesTo: "target",
    layers: anyLayer,
    args: [[]],
  },
  show: {
    capability: "hideable",
    appliesTo: "target",
    layers: anyLayer,
    args: [[]],
  },
  move: {
    capability: "slots",
    appliesTo: "parent",
    layers: anyLayer,
    args: [["to"]],
  },
  collapse: {
    capability: "slots",
    appliesTo: "target",
    layers: anyLayer,
    args: [["items", "into", "label"]],
  },
  pin: {
    capability: "slots",
    appliesTo: "parent",
    layers: anyLayer,
    args: [["where"]],
  },
  setLayout: {
    capability: "layout",
    appliesTo: "target",
    layers: anyLayer,
    args: [
      ["mode", "align", "at"],
      ["mode", "columns", "align", "at"],
    ],
  },
  span: {
    capability: "layout",
    appliesTo: "parent",
    layers: anyLayer,
    args: [["columns", "at"]],
  },
  insert: {
    capability: "insertable",
    appliesTo: "target",
    layers: anyLayer,
    args: [["node", "at"]],
  },
  wrap: {
    capability: "insertable",
    appliesTo: "target",
    layers: anyLayer,
    args: [
      ["id", "items", "mode", "align"],
      ["id", "items", "mode", "columns", "align"],
    ],
  },
  remove: {
    capability: "insertable",
    appliesTo: "parent",
    layers: anyLayer,
    args: [[]],
  },
  setDefault: {
    capability: "form",
    appliesTo: "parent",
    layers: anyLayer,
    args: [["value"]],
  },
  setPresentation: {
    capability: "presentation",
    appliesTo: "target",
    layers: anyLayer,
    args: [["as"], ["as", "side"]],
  },
  setSize: {
    capability: "presentation",
    appliesTo: "target",
    layers: anyLayer,
    args: [["size"]],
  },
  setLanding: {
    capability: "nav",
    appliesTo: "parent",
    layers: anyLayer,
    args: [[]],
  },
  promote: {
    capability: "actions",
    appliesTo: "parent",
    layers: anyLayer,
    args: [[]],
  },
  demote: {
    capability: "actions",
    appliesTo: "parent",
    layers: anyLayer,
    args: [[]],
  },
  bindShortcut: {
    capability: "actions",
    appliesTo: "parent",
    layers: anyLayer,
    args: [["keys"]],
  },
  setSort: {
    capability: "data",
    appliesTo: "target",
    layers: anyLayer,
    args: [["sort"]],
  },
  setFilter: {
    capability: "data",
    appliesTo: "target",
    layers: anyLayer,
    args: [["filter"]],
  },
  clearFilter: {
    capability: "data",
    appliesTo: "target",
    layers: anyLayer,
    args: [["field"]],
  },
  setPage: {
    capability: "data",
    appliesTo: "target",
    layers: ["session"],
    args: [["index", "size"]],
  },
  setGroupBy: {
    capability: "data",
    appliesTo: "target",
    layers: anyLayer,
    args: [["fields"]],
  },
  addDerived: {
    capability: "data",
    appliesTo: "target",
    layers: anyLayer,
    args: [["id", "label", "expr", "format"]],
  },
  addAggregate: {
    capability: "data",
    appliesTo: "target",
    layers: anyLayer,
    args: [["id", "label", "expr"]],
  },
  formatField: {
    capability: "data",
    appliesTo: "target",
    layers: anyLayer,
    args: [["field", "format"]],
  },
  addHighlight: {
    capability: "data",
    appliesTo: "target",
    layers: anyLayer,
    args: [["id", "when", "tone"]],
  },
  addSortOption: {
    capability: "data",
    appliesTo: "target",
    layers: anyLayer,
    args: [["id", "label", "sort"]],
  },
  addFilterControl: {
    capability: "data",
    appliesTo: "target",
    layers: anyLayer,
    args: [["id", "field", "control", "label"]],
  },
  addPreset: {
    capability: "data",
    appliesTo: "target",
    layers: anyLayer,
    args: [["id", "label", "filters", "sort"]],
  },
  setViewKind: {
    capability: "data",
    appliesTo: "target",
    layers: anyLayer,
    args: [["kind"]],
  },
  configureChart: {
    capability: "data",
    appliesTo: "target",
    layers: anyLayer,
    args: [["type", "x", "y", "series", "stacking", "format"]],
  },
  configureStat: {
    capability: "data",
    appliesTo: "target",
    layers: anyLayer,
    args: [["metric", "comparison", "format"]],
  },
  removeUserItem: {
    capability: "data",
    appliesTo: "target",
    layers: anyLayer,
    args: [["id"]],
  },
  setColumnWidth: {
    capability: "data",
    appliesTo: "parent",
    layers: anyLayer,
    args: [["width"]],
  },
  setDensity: {
    capability: null,
    appliesTo: "surface",
    layers: anyLayer,
    args: [["density"]],
  },
  setTextScale: {
    capability: null,
    appliesTo: "app",
    layers: anyLayer,
    args: [["scale"]],
  },
  setMotion: {
    capability: null,
    appliesTo: "app",
    layers: anyLayer,
    args: [["motion"]],
  },
}
