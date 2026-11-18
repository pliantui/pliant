import type { Op } from "@pliantui/contract"

function idsIn(address: string): string[] {
  if (address.startsWith("@")) {
    return []
  }
  const segments = address.split("/")
  const ids = [segments[0]?.replace(/\[\]$/, "") ?? ""]
  for (let index = 1; index < segments.length - 1; index += 2) {
    const id = segments[index + 1]
    if (segments[index] === "slots" && id !== undefined) {
      ids.push(id)
    }
  }
  return ids
}

/**
 * The ids of the nodes an op's addresses point at: every node on the way to
 * its target and `move … into` destination, and a wrap's items. The id an
 * `insert` or `wrap` creates isn't one of them.
 */
export function referencedNodes(op: Op): string[] {
  const ids = idsIn(op.target)
  if (op.op === "move" && "into" in op.to) {
    ids.push(...idsIn(op.to.into))
  }
  if (op.op === "wrap") {
    ids.push(...op.items)
  }
  return ids
}
