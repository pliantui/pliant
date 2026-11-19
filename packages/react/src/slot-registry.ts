import type { ReactNode } from "react"

import { slotIdSchema } from "@pliantui/contract"

import { isDevelopment } from "./is-development"

interface Declaration {
  readonly rank: number
  readonly region: string
  readonly slots: Readonly<Record<string, ReactNode>>
  retiring: boolean
}

/**
 * The slots of every mounted region of a surface, so a region can render a
 * slot an op moved into it from the region that declares it.
 */
export interface SlotRegistry {
  /**
   * Declares a region's slots for `owner` until the returned function is
   * called, replacing what `owner` declared before. When two regions declare
   * a slot, the one whose owner declared first wins, even after the other
   * declares again. In development, warns once about each slot id that isn't
   * kebab-case, and about region or slot ids that another region declares.
   */
  readonly declare: (
    owner: object,
    region: string,
    slots: Readonly<Record<string, ReactNode>>
  ) => () => void
  /**
   * Marks what `owner` declared as about to be undeclared: it no longer
   * wins over another declaration of a slot, nor counts as a duplicate,
   * until `owner` declares again.
   */
  readonly retire: (owner: object) => void
  /** The content of a declared slot, or `undefined`. */
  readonly getContent: (id: string) => ReactNode
  /** Calls `listener` when the content of slot `id` changes. */
  readonly subscribe: (id: string, listener: () => void) => () => void
}

export function createSlotRegistry(): SlotRegistry {
  const declarations = new Map<object, Declaration>()
  const ownersById = new Map<string, Set<object>>()
  const ownersByRegion = new Map<string, Set<object>>()
  const ranks = new WeakMap<object, number>()
  const listeners = new Map<string, Set<() => void>>()
  const warned = new Set<string>()
  let nextRank = 0

  function warnOnce(key: string, message: string) {
    if (!warned.has(key)) {
      warned.add(key)
      console.warn(message)
    }
  }

  // An active declaration wins over a retiring one, then the first owner.
  function ownerOf(id: string, except?: object) {
    let first: Declaration | undefined
    for (const owner of ownersById.get(id) ?? []) {
      const declaration = declarations.get(owner)
      if (
        owner !== except &&
        declaration &&
        (!first ||
          (first.retiring && !declaration.retiring) ||
          (first.retiring === declaration.retiring &&
            declaration.rank < first.rank))
      ) {
        first = declaration
      }
    }
    return first
  }

  function getContent(id: string) {
    return ownerOf(id)?.slots[id]
  }

  function update(ids: Iterable<string>, change: () => void) {
    const before = new Map([...ids].map((id) => [id, getContent(id)]))
    change()
    for (const [id, content] of before) {
      if (!Object.is(content, getContent(id))) {
        for (const listener of listeners.get(id) ?? []) {
          listener()
        }
      }
    }
  }

  function index(
    owners: Map<string, Set<object>>,
    owner: object,
    keys: readonly string[],
    add: boolean
  ) {
    for (const key of keys) {
      let set = owners.get(key)
      if (add) {
        if (!set) {
          set = new Set()
          owners.set(key, set)
        }
        set.add(owner)
      } else if (set) {
        set.delete(owner)
        if (set.size === 0) {
          owners.delete(key)
        }
      }
    }
  }

  function indexDeclaration(
    owner: object,
    declaration: Declaration | undefined,
    add: boolean
  ) {
    if (declaration) {
      index(ownersById, owner, Object.keys(declaration.slots), add)
      index(ownersByRegion, owner, [declaration.region], add)
    }
  }

  function check(owner: object, { region, slots }: Declaration) {
    for (const other of ownersByRegion.get(region) ?? []) {
      if (other !== owner && declarations.get(other)?.retiring === false) {
        warnOnce(
          `region:${region}`,
          `Pliant: two mounted regions use the id "${region}". Region ids must be unique within a surface.`
        )
      }
    }
    for (const id of Object.keys(slots)) {
      if (!slotIdSchema.safeParse(id).success) {
        warnOnce(
          `key:${region}/${id}`,
          `Pliant: region "${region}" has a slot "${id}". Slot ids must be kebab-case and start with a letter: keys that look like numbers change the base order.`
        )
      }
      const other = ownerOf(id, owner)
      if (other && !other.retiring) {
        warnOnce(
          `slot:${id}`,
          `Pliant: regions "${other.region}" and "${region}" both declare a slot "${id}". Slot ids must be unique within a surface.`
        )
      }
    }
  }

  function declare(
    owner: object,
    region: string,
    slots: Readonly<Record<string, ReactNode>>
  ) {
    let rank = ranks.get(owner)
    if (rank === undefined) {
      rank = nextRank++
      ranks.set(owner, rank)
    }
    const declaration: Declaration = { rank, region, slots, retiring: false }
    if (isDevelopment) {
      check(owner, declaration)
    }
    const previous = declarations.get(owner)
    const ids = Object.keys(slots)
    update(new Set([...Object.keys(previous?.slots ?? {}), ...ids]), () => {
      indexDeclaration(owner, previous, false)
      declarations.set(owner, declaration)
      indexDeclaration(owner, declaration, true)
    })
    return () => {
      if (declarations.get(owner) === declaration) {
        update(ids, () => {
          declarations.delete(owner)
          indexDeclaration(owner, declaration, false)
        })
      }
    }
  }

  function retire(owner: object) {
    const declaration = declarations.get(owner)
    if (declaration && !declaration.retiring) {
      update(Object.keys(declaration.slots), () => {
        declaration.retiring = true
      })
    }
  }

  return {
    declare,
    retire,
    getContent,
    subscribe(id, listener) {
      let set = listeners.get(id)
      if (!set) {
        set = new Set()
        listeners.set(id, set)
      }
      set.add(listener)
      return () => {
        set.delete(listener)
        if (set.size === 0) {
          listeners.delete(id)
        }
      }
    },
  }
}
