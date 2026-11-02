import type { Breakpoint, Op } from "@pliantui/contract"

export type OpPropertyKey =
  | "chart"
  | "collapse"
  | "default"
  | "density"
  | "groupBy"
  | "inserted"
  | "label"
  | "landing"
  | "motion"
  | "page"
  | "pin"
  | "position"
  | "presentation"
  | "promoted"
  | "shortcut"
  | "size"
  | "sort"
  | "stat"
  | "textScale"
  | "viewKind"
  | "visible"
  | "width"
  | `filter.${string}`
  | `format.${string}`
  | `layout.${Breakpoint}`
  | `props.${string}`
  | `span.${Breakpoint}`
  | `userItems.${string}`

interface OpProperty {
  address: string
  property: OpPropertyKey
}

// Layout changes without `at` apply from md up, so they share a key with an
// explicit `at: "md"`.
const defaultBreakpoint: Breakpoint = "md"

function parentOf(address: string): string {
  return address.replace(/\/[^/]+\/[^/]+$/, "")
}

export function opProperty(op: Op): OpProperty {
  switch (op.op) {
    case "setProp":
      return { address: op.target, property: `props.${op.prop}` }
    case "rename":
      return { address: op.target, property: "label" }
    case "hide":
    case "show":
      return { address: op.target, property: "visible" }
    case "move":
      return { address: op.target, property: "position" }
    case "collapse":
      return { address: op.target, property: "collapse" }
    case "pin":
      return { address: op.target, property: "pin" }
    case "setLayout":
      return {
        address: op.target,
        property: `layout.${op.at ?? defaultBreakpoint}`,
      }
    case "span":
      return {
        address: op.target,
        property: `span.${op.at ?? defaultBreakpoint}`,
      }
    // An inserted node or wrapper is the slot `remove` targets, so the three
    // share one key and the later op decides whether the slot exists.
    case "insert":
      return {
        address: `${op.target}/slots/${op.node.id}`,
        property: "inserted",
      }
    case "wrap":
      return { address: `${op.target}/slots/${op.id}`, property: "inserted" }
    case "remove":
      return { address: op.target, property: "inserted" }
    case "setDefault":
      return { address: op.target, property: "default" }
    case "setPresentation":
      return { address: op.target, property: "presentation" }
    case "setSize":
      return { address: op.target, property: "size" }
    // A nav node has one landing item, so the key is on the node, not the item.
    case "setLanding":
      return { address: parentOf(op.target), property: "landing" }
    case "promote":
    case "demote":
      return { address: op.target, property: "promoted" }
    case "bindShortcut":
      return { address: op.target, property: "shortcut" }
    case "setSort":
      return { address: op.target, property: "sort" }
    case "setFilter":
      return { address: op.target, property: `filter.${op.filter.field}` }
    case "clearFilter":
      return { address: op.target, property: `filter.${op.field}` }
    case "setPage":
      return { address: op.target, property: "page" }
    case "setGroupBy":
      return { address: op.target, property: "groupBy" }
    // `removeUserItem` names only an id, so every user-added item on a node
    // shares one id space.
    case "addDerived":
    case "addAggregate":
    case "addHighlight":
    case "addSortOption":
    case "addFilterControl":
    case "addPreset":
    case "removeUserItem":
      return { address: op.target, property: `userItems.${op.id}` }
    case "formatField":
      return { address: op.target, property: `format.${op.field}` }
    case "setViewKind":
      return { address: op.target, property: "viewKind" }
    case "configureChart":
      return { address: op.target, property: "chart" }
    case "configureStat":
      return { address: op.target, property: "stat" }
    case "setColumnWidth":
      return { address: op.target, property: "width" }
    case "setDensity":
      return { address: op.target, property: "density" }
    case "setTextScale":
      return { address: op.target, property: "textScale" }
    case "setMotion":
      return { address: op.target, property: "motion" }
  }
  return op satisfies never
}
