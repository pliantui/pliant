import type { Node } from "ts-morph"

import type { Manifest } from "@pliantui/contract"

import { createDiagnostic, type Diagnostic } from "../utils/diagnostic"

/** The kinds of what Pliant itself declares. */
export const builtInKinds = {
  region: "pliant:region",
  table: "pliant:table",
  column: "pliant:column",
  form: "pliant:form",
  field: "pliant:field",
  nav: "pliant:nav",
  navItem: "pliant:nav-item",
  slot: "pliant:slot",
} as const

/** What a node is: a built-in kind, or the kind of a component's manifest. */
export interface NodeKind {
  readonly kind: string
  readonly manifest?: Manifest | undefined
}

export interface ScannedNode {
  readonly id: string
  /**
   * The node that holds it, `null` at the top of the surface, `undefined`
   * when it can't be read. Columns, fields and nav items have none: they
   * are items, not nodes.
   */
  parent: string | null | undefined
  /** What the node declares itself as, such as a region. */
  own: NodeKind | undefined
  /** What a slot renders, for a node that is a slot. */
  content: NodeKind | undefined
}

export interface ScannedSurface {
  readonly surface: string
  readonly nodes: Map<string, ScannedNode>
  /** Whether part of the surface couldn't be read. */
  incomplete: boolean
  /** Whether its `PliantRoot` is in an App Router layout. */
  fromLayout: boolean
  /** The files of the components the surface renders. */
  readonly files: Set<string>
  /**
   * The code the scan read for the surface: the functions it walked, and
   * the values it followed into.
   */
  readonly entered: Set<Node>
  /**
   * What the scan followed there: the JSX elements and hook calls it
   * walked, and the references it followed to a component or function.
   */
  readonly consumed: Set<Node>
}

export interface ScanReport {
  readonly errors: Diagnostic[]
  readonly warnings: Diagnostic[]
}

function describeParent(parent: string | null) {
  return parent ?? "the top of the surface"
}

function merge(
  id: string,
  label: string,
  current: NodeKind | undefined,
  next: NodeKind | undefined
): { kind: NodeKind | undefined; conflict?: string } {
  if (!current || !next || current.kind === next.kind) {
    return { kind: current ?? next }
  }
  return {
    kind: current,
    conflict: `${id} is ${label} both ${current.kind} and ${next.kind}. Node ids must be unique on a surface.`,
  }
}

/**
 * Records a node on the surface. A node found again must agree with what
 * was found before: the same parent and the same kind.
 */
export function addNode(
  surface: ScannedSurface,
  node: Omit<ScannedNode, "parent"> & { parent: string | null | undefined },
  at: Node,
  report: ScanReport
) {
  const existing = surface.nodes.get(node.id)
  if (!existing) {
    surface.nodes.set(node.id, { ...node })
    return
  }
  if (
    existing.parent !== undefined &&
    node.parent !== undefined &&
    existing.parent !== node.parent
  ) {
    report.errors.push(
      createDiagnostic(
        at,
        `${node.id} is rendered in both ${describeParent(existing.parent)} and ${describeParent(node.parent)} on ${surface.surface}. Node ids must be unique on a surface.${surface.fromLayout ? ` ${surface.surface} is rendered by a layout, so it spans every page under that layout.` : ""}`
      )
    )
    return
  }
  existing.parent = existing.parent ?? node.parent
  for (const [key, label] of [
    ["own", "declared as"],
    ["content", "a slot that renders"],
  ] as const) {
    const { kind, conflict } = merge(node.id, label, existing[key], node[key])
    existing[key] = kind
    if (conflict) {
      report.errors.push(createDiagnostic(at, conflict))
    }
  }
}
