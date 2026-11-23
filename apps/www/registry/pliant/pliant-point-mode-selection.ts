import type { Op } from "@pliantui/contract"

/**
 * A node users can point at: its id and the label shown on its outline. A
 * target with a `slots` collection, like a region, also outlines each of its
 * slots, which users can then move, resize and hide as its manifest allows.
 * The ask panel's targets fit here as they are.
 */
interface PliantPointTarget {
  id: string
  label: string
  context?: {
    manifest: {
      capabilities: {
        slots?: boolean
        layout?: boolean
        hideable?: boolean
      }
    }
    collection?: {
      name: string
      items: readonly { id: string; label?: string }[]
    }
  }
}

/** What a part's flags forbid, by its address, such as `key-metrics/slots/revenue`. */
type PliantPointFlags = Readonly<
  Record<string, { required?: boolean; locked?: boolean }>
>

/** A slot of a target, outlined in point mode. */
interface PointPart {
  id: string
  label: string
  address: string
  parent: string
}

interface PointHandles {
  move: boolean
  span: boolean
  hide: boolean
}

const noHandles: PointHandles = { move: false, span: false, hide: false }

function partsOf(targets: readonly PliantPointTarget[]): PointPart[] {
  return targets.flatMap((target) =>
    target.context?.collection?.name === "slots"
      ? target.context.collection.items.map((item) => ({
          id: item.id,
          label: item.label ?? item.id,
          address: `${target.id}/slots/${item.id}`,
          parent: target.id,
        }))
      : []
  )
}

// A part's handles: only those its region's manifest allows and its flags
// don't forbid. Resizing needs a grid of more than one column. A target
// that isn't a slot has none, since nothing above it could reset them.
function handlesOf(
  part: PointPart | undefined,
  targets: readonly PliantPointTarget[],
  flags: PliantPointFlags,
  columns: number
): PointHandles {
  const capabilities = targets.find((target) => target.id === part?.parent)
    ?.context?.manifest.capabilities
  const flag = part ? flags[part.address] : undefined
  if (!part || !capabilities || flag?.locked) return noHandles
  return {
    move: capabilities.slots === true,
    span: capabilities.layout === true && columns > 1,
    hide: capabilities.hideable === true && !flag?.required,
  }
}

// Moves the part `id` of `order`, the shown parts in their order, to the
// place of the part at `to`, or `undefined` when it stays where it is.
function moveOp(
  address: string,
  order: readonly string[],
  id: string,
  to: number
): Op | undefined {
  const from = order.indexOf(id)
  const anchor = order[Math.max(0, Math.min(order.length - 1, to))]
  if (from === -1 || anchor === undefined || anchor === id) return undefined
  return {
    op: "move",
    target: address,
    to: to < from ? { before: anchor } : { after: anchor },
  }
}

// Tailwind's default breakpoints, widest first.
const breakpoints = [
  ["2xl", 1536],
  ["xl", 1280],
  ["lg", 1024],
  ["md", 768],
  ["sm", 640],
] as const

// A span applies from the breakpoint the page is at up, so a narrower
// screen keeps the columns it had.
function spanOp(address: string, columns: number, width: number): Op {
  const at = breakpoints.find(([, min]) => width >= min)?.[0]
  return {
    op: "span",
    target: address,
    columns,
    ...(at === undefined ? {} : { at }),
  }
}

export {
  handlesOf,
  moveOp,
  partsOf,
  spanOp,
  type PliantPointFlags,
  type PliantPointTarget,
  type PointHandles,
  type PointPart,
}
