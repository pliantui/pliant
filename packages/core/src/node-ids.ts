import type { Op } from "@pliantui/contract"

export interface NodeReference {
  readonly id: string
  // A wrapper is only ever addressed by its id, never as a slot.
  readonly slot: boolean
}

function referencesIn(address: string): NodeReference[] {
  if (address.startsWith("@")) {
    return []
  }
  const segments = address.split("/")
  const references: NodeReference[] = []
  segments.forEach((segment, index) => {
    if (index === 0) {
      references.push({ id: segment.replace(/\[\]$/, ""), slot: false })
    } else if (index % 2 === 0 && segments[index - 1] === "slots") {
      references.push({ id: segment, slot: true })
    }
  })
  return references
}

/** The nodes an op's addresses point at, other than one it creates. */
export function referencedNodes(op: Op): NodeReference[] {
  const references = referencesIn(op.target)
  if (op.op === "move" && "into" in op.to) {
    references.push(...referencesIn(op.to.into))
  }
  if (op.op === "wrap") {
    references.push(...op.items.map((id) => ({ id, slot: true })))
  }
  return references
}

export function createdNodeId(op: Op): string | undefined {
  switch (op.op) {
    case "insert":
      return op.node.id
    case "wrap":
      return op.id
    default:
      return undefined
  }
}
