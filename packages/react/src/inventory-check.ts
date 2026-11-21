import { useEffect } from "react"

import type { LayerStore } from "./layer-store"

/**
 * The part of a surface's entry in the inventory `pliantui scan` writes that
 * `PliantRoot` reads.
 *
 * @experimental
 */
export interface PliantInventory {
  readonly baseIds: { readonly ids: readonly string[] }
}

// Only development builds call these, so production bundles drop the module.
const inventories = new WeakMap<LayerStore, PliantInventory | undefined>()
const warned = new WeakMap<LayerStore, Set<string>>()

/** Gives the surface's inventory to the checks of what mounts in it. */
export function setInventory(
  store: LayerStore,
  inventory: PliantInventory | undefined
) {
  inventories.set(store, inventory)
}

function warnOnce(store: LayerStore, key: string, message: string) {
  let seen = warned.get(store)
  if (seen === undefined) {
    seen = new Set()
    warned.set(store, seen)
  }
  if (!seen.has(key)) {
    seen.add(key)
    console.warn(message)
  }
}

function warnUnscanned(store: LayerStore, ids: readonly string[]) {
  const { surface } = store
  const inventory = inventories.get(store)
  if (inventory === undefined) {
    return
  }
  // JavaScript callers can pass the whole inventory instead of the entry.
  const listed: unknown = (inventory as { baseIds?: { ids?: unknown } }).baseIds
    ?.ids
  if (!Array.isArray(listed)) {
    warnOnce(
      store,
      "",
      `Pliant: the \`inventory\` PliantRoot got for the surface "${surface}" isn't an entry of the inventory \`pliantui scan\` writes. Pass the surface's entry, as in \`inventory["${surface}"]\`.`
    )
    return
  }
  for (const id of ids) {
    if (!listed.includes(id)) {
      warnOnce(
        store,
        id,
        `Pliant: "${id}" mounted on the surface "${surface}", but the surface's inventory doesn't list it. Run \`npx pliantui scan\` to update the inventory. If it's up to date, the scan couldn't follow how "${id}" is rendered: see "What it reads" under \`pliantui scan\` in the CLI docs.`
      )
    }
  }
}

/**
 * Warns once per id about each of `ids`, a region or table and the nodes it
 * declares, that the surface's inventory doesn't list, when `PliantRoot`
 * got one. `ids` is joined with newlines, so it stays the same value while
 * the ids do. Call it only in development.
 */
export function useWarnUnscanned(store: LayerStore, ids: string) {
  useEffect(() => {
    warnUnscanned(store, ids.split("\n"))
  }, [store, ids])
}
