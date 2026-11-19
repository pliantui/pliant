import type { Capability } from "./capability"
import type { Layer } from "./layer"
import type { OpName } from "./op"

type AppliesTo = "target" | "parent" | "surface" | "app"

export interface OpDefinition {
  /**
   * The capability the op's target must have, or `null` for none. An op whose
   * shapes need different capabilities lists one per `args` list, and
   * `appliesTo` does the same: `capability[i]` and `appliesTo[i]` apply to the
   * shape `args[i]`.
   */
  readonly capability: Capability | null | readonly Capability[]
  readonly appliesTo: AppliesTo | readonly AppliesTo[]
  readonly layers: readonly Layer[]
  /**
   * The op's top-level argument keys, without `op` and `target`: one list per
   * shape. When `capability` is a single value, the order of the lists doesn't
   * matter. When it is a list, the order always matters: the lists go from
   * narrowest to widest, and an op's shape is the first list that contains
   * every argument key the op has.
   *
   * An op that fails its schema comes from a newer version when it passes
   * after removing every key other than `op` and `target` that appears in none
   * of these lists. Unknown keys nested inside an argument, a new value for a
   * shape's discriminator, and a key added to one shape that another shape
   * already has all leave the op invalid.
   */
  readonly args: readonly (readonly string[])[]
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
    args: [
      ["items", "into", "label"],
      ["items", "into"],
    ],
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
    capability: ["form", "defaults"],
    appliesTo: ["parent", "target"],
    layers: anyLayer,
    args: [["value"], ["prop", "value"]],
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
