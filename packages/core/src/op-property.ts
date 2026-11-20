import type { Breakpoint, Op } from "@pliantui/contract"

import { identityOf, parentOf } from "./node-identity"

const userItemKinds = [
  "derived",
  "aggregate",
  "highlight",
  "sortOption",
  "filterControl",
  "preset",
] as const

type UserItemKind = (typeof userItemKinds)[number]

/**
 * A property an op writes on a node or item. Keyed families carry their key
 * after a dot: `collapse.<item>`, `defaults.<prop>`, `filter.<field>`,
 * `format.<field>`, `props.<prop>`, and `<kind>.<id>` for each user item kind
 * (`derived`, `aggregate`, `highlight`, `sortOption`, `filterControl`,
 * `preset`). No built-in op writes a property that starts with `ext.`: the
 * contract reserves `ext.<namespace>.<name>` for namespaced ops.
 */
export type OpPropertyKey =
  | "chart"
  | "default"
  | "density"
  | "groupBy"
  | "inserted"
  | "label"
  | "landing"
  | "layout"
  | "motion"
  | "page"
  | "presentation"
  | "shortcut"
  | "size"
  | "sort"
  | "span"
  | "stat"
  | "textScale"
  | "viewKind"
  | "visible"
  | "width"
  | `collapse.${string}`
  | `defaults.${string}`
  | `filter.${string}`
  | `format.${string}`
  | `props.${string}`
  | `${UserItemKind}.${string}`

/** One (identity, property) pair an op writes; see `opProperties`. */
export interface OpProperty {
  /** The identity written, as in `ResolvedLayers.properties`. */
  readonly address: string
  /**
   * The property written. `"placement"` resolves into
   * `ResolvedLayers.placements`, never into `properties`.
   */
  readonly property: OpPropertyKey | "placement"
  /**
   * Set for `layout` and `span` only: the breakpoint written, `md` when the
   * op has no `at`.
   */
  readonly breakpoint?: Breakpoint
}

// Layout changes without `at` apply from md up, so they share a breakpoint
// with an explicit `at: "md"`.
const defaultBreakpoint: Breakpoint = "md"

function one(address: string, property: OpProperty["property"]): OpProperty[] {
  return [{ address, property }]
}

/**
 * The (address, property) pairs an op writes, following the op → property
 * table that `resolveLayers` resolves by. Addresses are identities: a node's
 * bare id, an item's address on its node, or a reserved target. `remove` and
 * `removeUserItem` list the pairs they may clear; resolution decides which
 * ones they do. Two ops with the same pairs (and breakpoints) write the same
 * values, so a runtime can replace the earlier one with the later.
 *
 * Takes a valid op, such as one from `validateOverlay` or a `valid` check.
 */
export function opProperties(op: Op): readonly OpProperty[] {
  const target = identityOf(op.target)
  switch (op.op) {
    case "setProp":
      return one(target, `props.${op.prop}`)
    case "rename":
      return one(target, "label")
    case "hide":
    case "show":
      return one(target, "visible")
    case "move":
    case "pin":
    case "promote":
    case "demote":
      return one(target, "placement")
    // Collapse items are bare ids, so membership is keyed on the container.
    case "collapse":
      return op.items.map((item) => ({
        address: target,
        property: `collapse.${item}`,
      }))
    case "setLayout":
      return [
        {
          address: target,
          property: "layout",
          breakpoint: op.at ?? defaultBreakpoint,
        },
      ]
    case "span":
      return [
        {
          address: target,
          property: "span",
          breakpoint: op.at ?? defaultBreakpoint,
        },
      ]
    case "insert":
      return one(op.node.id, "inserted")
    case "wrap":
      return [
        { address: op.id, property: "inserted" },
        ...op.items.map((item) => ({
          address: item,
          property: "placement" as const,
        })),
      ]
    case "remove":
      return one(target, "inserted")
    case "setDefault":
      return one(
        target,
        op.prop === undefined ? "default" : `defaults.${op.prop}`
      )
    case "setPresentation":
      return one(target, "presentation")
    case "setSize":
      return one(target, "size")
    // A nav node has one landing item, so the key is on the node, not the item.
    case "setLanding":
      return one(parentOf(op.target), "landing")
    case "bindShortcut":
      return one(target, "shortcut")
    case "setSort":
      return one(target, "sort")
    case "setFilter":
      return one(target, `filter.${op.filter.field}`)
    case "clearFilter":
      return one(target, `filter.${op.field}`)
    case "setPage":
      return one(target, "page")
    case "setGroupBy":
      return one(target, "groupBy")
    case "addDerived":
      return one(target, `derived.${op.id}`)
    case "addAggregate":
      return one(target, `aggregate.${op.id}`)
    case "addHighlight":
      return one(target, `highlight.${op.id}`)
    case "addSortOption":
      return one(target, `sortOption.${op.id}`)
    case "addFilterControl":
      return one(target, `filterControl.${op.id}`)
    case "addPreset":
      return one(target, `preset.${op.id}`)
    // `removeUserItem` names only an id, so it may clear that id in any kind.
    case "removeUserItem":
      return userItemKinds.map((kind) => ({
        address: target,
        property: `${kind}.${op.id}`,
      }))
    case "formatField":
      return one(target, `format.${op.field}`)
    case "setViewKind":
      return one(target, "viewKind")
    case "configureChart":
      return one(target, "chart")
    case "configureStat":
      return one(target, "stat")
    case "setColumnWidth":
      return one(target, "width")
    case "setDensity":
      return one(target, "density")
    case "setTextScale":
      return one(target, "textScale")
    case "setMotion":
      return one(target, "motion")
  }
  const unknown: never = op
  throw new TypeError(`Unknown op: ${JSON.stringify(unknown)}`)
}
