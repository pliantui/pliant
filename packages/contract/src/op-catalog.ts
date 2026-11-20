import type { Capability } from "./capability"
import type { Layer } from "./layer"
import type { OpName } from "./op"

type AppliesTo = "target" | "parent" | "surface" | "app"

export interface OpDefinition {
  /**
   * The capability that the manifest of the node the op applies to must have,
   * or `null` for none: one entry per `args` list, so `capability[i]` applies
   * to the shape `args[i]`.
   */
  readonly capability: readonly (Capability | null)[]
  /** The node the op applies to: one entry per `args` list, like `capability`. */
  readonly appliesTo: readonly AppliesTo[]
  readonly layers: readonly Layer[]
  /**
   * The op's top-level argument keys, without `op` and `target`: one list per
   * shape, ordered from narrowest to widest. An op takes the `capability` and
   * `appliesTo` entries of the first list that contains every argument key it
   * has.
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

// Builds an entry whose shapes all need the same capability on the same node.
function entry(
  capability: Capability | null,
  appliesTo: AppliesTo,
  args: OpDefinition["args"],
  layers: readonly Layer[] = anyLayer
): OpDefinition {
  return {
    capability: args.map(() => capability),
    appliesTo: args.map(() => appliesTo),
    layers,
    args,
  }
}

export const opCatalog: Readonly<Record<OpName, OpDefinition>> = {
  setProp: entry("props", "target", [["prop", "value"]]),
  rename: entry("label", "target", [["label"]]),
  hide: entry("hideable", "target", [[]]),
  show: entry("hideable", "target", [[]]),
  move: entry("slots", "parent", [["to"]]),
  collapse: entry("slots", "target", [
    ["items", "into"],
    ["items", "into", "label"],
  ]),
  pin: entry("slots", "parent", [["where"]]),
  setLayout: entry("layout", "target", [
    ["mode", "align", "at"],
    ["mode", "columns", "align", "at"],
  ]),
  span: entry("layout", "parent", [["columns", "at"]]),
  insert: entry("insertable", "target", [["node", "at"]]),
  wrap: entry("insertable", "target", [
    ["id", "items", "mode", "align"],
    ["id", "items", "mode", "columns", "align"],
  ]),
  remove: entry("insertable", "parent", [[]]),
  setDefault: {
    capability: ["form", "defaults"],
    appliesTo: ["parent", "target"],
    layers: anyLayer,
    args: [["value"], ["prop", "value"]],
  },
  setPresentation: entry("presentation", "target", [["as"], ["as", "side"]]),
  setSize: entry("presentation", "target", [["size"]]),
  setLanding: entry("nav", "parent", [[]]),
  promote: entry("actions", "parent", [[]]),
  demote: entry("actions", "parent", [[]]),
  bindShortcut: entry("actions", "parent", [["keys"]]),
  setSort: entry("data", "target", [["sort"]]),
  setFilter: entry("data", "target", [["filter"]]),
  clearFilter: entry("data", "target", [["field"]]),
  setPage: entry("data", "target", [["index", "size"]], ["session"]),
  setGroupBy: entry("data", "target", [["fields"]]),
  addDerived: entry("data", "target", [["id", "label", "expr", "format"]]),
  addAggregate: entry("data", "target", [["id", "label", "expr"]]),
  formatField: entry("data", "target", [["field", "format"]]),
  addHighlight: entry("data", "target", [["id", "when", "tone"]]),
  addSortOption: entry("data", "target", [["id", "label", "sort"]]),
  addFilterControl: entry("data", "target", [
    ["id", "field", "control", "label"],
  ]),
  addPreset: entry("data", "target", [["id", "label", "filters", "sort"]]),
  setViewKind: entry("data", "target", [["kind"]]),
  configureChart: entry("data", "target", [
    ["type", "x", "y", "series", "stacking", "format"],
  ]),
  configureStat: entry("data", "target", [["metric", "comparison", "format"]]),
  removeUserItem: entry("data", "target", [["id"]]),
  setColumnWidth: entry("data", "parent", [["width"]]),
  setDensity: entry(null, "surface", [["density"]]),
  setTextScale: entry(null, "app", [["scale"]]),
  setMotion: entry(null, "app", [["motion"]]),
}
