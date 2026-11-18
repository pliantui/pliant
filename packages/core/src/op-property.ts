import type { Breakpoint, Op } from "@pliantui/contract"

const userItemKinds = [
  "derived",
  "aggregate",
  "highlight",
  "sortOption",
  "filterControl",
  "preset",
] as const

type UserItemKind = (typeof userItemKinds)[number]

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
  | "placement"
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
  | `filter.${string}`
  | `format.${string}`
  | `props.${string}`
  | `${UserItemKind}.${string}`

export interface OpProperty {
  readonly address: string
  readonly property: OpPropertyKey
  readonly breakpoint?: Breakpoint
}

// Layout changes without `at` apply from md up, so they share a breakpoint
// with an explicit `at: "md"`.
const defaultBreakpoint: Breakpoint = "md"

function parentOf(address: string): string {
  return address.replace(/\/[^/]+\/[^/]+$/, "")
}

export type IdentityOf = (container: string, item: string) => string

const slotOf: IdentityOf = (container, item) => `${container}/slots/${item}`

function one(address: string, property: OpPropertyKey): OpProperty[] {
  return [{ address, property }]
}

/**
 * The (address, property) pairs an op writes. `remove` and `removeUserItem`
 * list the pairs they may clear; resolution decides which ones they do.
 * `identityOf` finds the address of a wrapped item from the wrap's target and
 * the item's id, by default `<target>/slots/<item>`.
 */
export function opProperties(
  op: Op,
  identityOf: IdentityOf = slotOf
): readonly OpProperty[] {
  switch (op.op) {
    case "setProp":
      return one(op.target, `props.${op.prop}`)
    case "rename":
      return one(op.target, "label")
    case "hide":
    case "show":
      return one(op.target, "visible")
    case "move":
    case "pin":
    case "promote":
    case "demote":
      return one(op.target, "placement")
    // Collapse items are bare ids, so membership is keyed on the container.
    case "collapse":
      return op.items.map((item) => ({
        address: op.target,
        property: `collapse.${item}`,
      }))
    case "setLayout":
      return [
        {
          address: op.target,
          property: "layout",
          breakpoint: op.at ?? defaultBreakpoint,
        },
      ]
    case "span":
      return [
        {
          address: op.target,
          property: "span",
          breakpoint: op.at ?? defaultBreakpoint,
        },
      ]
    case "insert":
      return one(`${op.target}/slots/${op.node.id}`, "inserted")
    // A wrapper is addressed by its own id, and its items keep their
    // addresses, so later ops on them still match.
    case "wrap":
      return [
        { address: op.id, property: "inserted" },
        ...op.items.map((item) => ({
          address: identityOf(op.target, item),
          property: "placement" as const,
        })),
      ]
    case "remove":
      return one(op.target, "inserted")
    case "setDefault":
      return one(op.target, "default")
    case "setPresentation":
      return one(op.target, "presentation")
    case "setSize":
      return one(op.target, "size")
    // A nav node has one landing item, so the key is on the node, not the item.
    case "setLanding":
      return one(parentOf(op.target), "landing")
    case "bindShortcut":
      return one(op.target, "shortcut")
    case "setSort":
      return one(op.target, "sort")
    case "setFilter":
      return one(op.target, `filter.${op.filter.field}`)
    case "clearFilter":
      return one(op.target, `filter.${op.field}`)
    case "setPage":
      return one(op.target, "page")
    case "setGroupBy":
      return one(op.target, "groupBy")
    case "addDerived":
      return one(op.target, `derived.${op.id}`)
    case "addAggregate":
      return one(op.target, `aggregate.${op.id}`)
    case "addHighlight":
      return one(op.target, `highlight.${op.id}`)
    case "addSortOption":
      return one(op.target, `sortOption.${op.id}`)
    case "addFilterControl":
      return one(op.target, `filterControl.${op.id}`)
    case "addPreset":
      return one(op.target, `preset.${op.id}`)
    // `removeUserItem` names only an id, so it may clear that id in any kind.
    case "removeUserItem":
      return userItemKinds.map((kind) => ({
        address: op.target,
        property: `${kind}.${op.id}`,
      }))
    case "formatField":
      return one(op.target, `format.${op.field}`)
    case "setViewKind":
      return one(op.target, "viewKind")
    case "configureChart":
      return one(op.target, "chart")
    case "configureStat":
      return one(op.target, "stat")
    case "setColumnWidth":
      return one(op.target, "width")
    case "setDensity":
      return one(op.target, "density")
    case "setTextScale":
      return one(op.target, "textScale")
    case "setMotion":
      return one(op.target, "motion")
  }
  const unknown: never = op
  throw new TypeError(`Unknown op: ${JSON.stringify(unknown)}`)
}
