import type { ReactNode } from "react"

import { slotIdSchema } from "@pliantui/contract"

interface Declaration {
  readonly rank: number
  readonly region: string
  readonly slots: Readonly<Record<string, ReactNode>>
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
  /** The content of a declared slot, or `undefined`. */
  readonly getContent: (id: string) => ReactNode
  /** Calls `listener` when the content of slot `id` changes. */
  readonly subscribe: (id: string, listener: () => void) => () => void
}

const isDevelopment = process.env.NODE_ENV !== "production"

export function createSlotRegistry(): SlotRegistry {
  const declarations = new Map<object, Declaration>()
  const ranks = new WeakMap<object, number>()
  const listeners = new Map<string, Set<() => void>>()
  const warned = new Set<string>()
  let nextRank = 0

  function warnOnce(message: string) {
    if (!warned.has(message)) {
      warned.add(message)
      console.warn(message)
    }
  }

  function ownerOf(id: string, except?: object) {
    let first: Declaration | undefined
    for (const [owner, declaration] of declarations) {
      if (
        owner !== except &&
        Object.hasOwn(declaration.slots, id) &&
        (!first || declaration.rank < first.rank)
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

  function check(owner: object, { region, slots }: Declaration) {
    for (const [other, declaration] of declarations) {
      if (other !== owner && declaration.region === region) {
        warnOnce(
          `Pliant: two mounted regions use the id "${region}". Region ids must be unique within a surface.`
        )
      }
    }
    for (const id of Object.keys(slots)) {
      if (!slotIdSchema.safeParse(id).success) {
        warnOnce(
          `Pliant: region "${region}" has a slot "${id}". Slot ids must be kebab-case and start with a letter: keys that look like numbers change the base order.`
        )
      }
      const other = ownerOf(id, owner)
      if (other) {
        warnOnce(
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
    const declaration: Declaration = { rank, region, slots }
    if (isDevelopment) {
      check(owner, declaration)
    }
    const previous = declarations.get(owner)
    update(
      new Set([...Object.keys(previous?.slots ?? {}), ...Object.keys(slots)]),
      () => {
        declarations.set(owner, declaration)
      }
    )
    return () => {
      if (declarations.get(owner) === declaration) {
        update(Object.keys(slots), () => {
          declarations.delete(owner)
        })
      }
    }
  }

  return {
    declare,
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
