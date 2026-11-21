import type { Layer } from "@pliantui/contract"

import type { PliantTableDataset } from "./table-aggregates"
import { viewerZones } from "./table-ops"

/**
 * The items (derived columns or aggregates) that `evaluator` accepts, each
 * with what it returns, and each that can't be a column with its reason: no
 * dataset, an id a column has, or the reason `evaluator` gives as text.
 * The ids it accepts are added to `taken`.
 * `prepare` creates the evaluator, given the dataset and the time zone
 * `today` reads in, by id, for the viewer's own items.
 */
export function acceptItems<
  T extends { readonly id: string; readonly layer: Layer },
  A extends object,
>(
  items: readonly T[],
  dataset: PliantTableDataset | undefined,
  taken: Set<string>,
  kind: string,
  prepare: (
    dataset: PliantTableDataset,
    zones: Readonly<Record<string, string>>
  ) => (item: T, todayTimeZone: string | undefined) => A | string
) {
  const accepted: (T & A)[] = []
  const issues: string[] = []
  const reject = ({ id }: T, reason: string) => {
    issues.push(`${kind} ${id}: ${reason}`)
  }
  try {
    if (!dataset) {
      throw new TypeError("pass the table's dataset to usePliantTable")
    }
    const zones = viewerZones(items)
    const evaluate = prepare(dataset, zones)
    for (const item of items) {
      const result = taken.has(item.id)
        ? "a column has its id"
        : evaluate(item, zones[item.id])
      if (typeof result === "string") {
        reject(item, result)
      } else {
        taken.add(item.id)
        accepted.push({ ...item, ...result })
      }
    }
  } catch (error) {
    for (const item of items) {
      reject(item, error instanceof Error ? error.message : String(error))
    }
  }
  return { accepted, issues }
}
