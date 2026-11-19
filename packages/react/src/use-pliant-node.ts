import { usePliantStatus } from "./use-pliant-status"

interface PliantNodeProps {
  readonly "data-pliant-id": string
  readonly "data-pliant-pending": "" | undefined
}

/**
 * Props for the root element of the node `id`: `data-pliant-id`, which
 * point mode and the ask panel find the node by, and `data-pliant-pending`
 * until the surface's layers have loaded.
 *
 * ```tsx
 * <div {...usePliantNode("orders-table")}>…</div>
 * ```
 *
 * @experimental
 */
export function usePliantNode(id: string): PliantNodeProps {
  const ready = usePliantStatus().status === "ready"
  return {
    "data-pliant-id": id,
    "data-pliant-pending": ready ? undefined : "",
  }
}
