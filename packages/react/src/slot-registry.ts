import type { ReactNode } from "react"

import { slotIdSchema } from "@pliantui/contract"

interface Declaration {
  readonly region: string
  readonly slots: Readonly<Record<string, ReactNode>>
}

/**
 * The slots of every mounted region of a surface, so a region can render a
 * slot an op moved into it from the region that declares it.
 */
export interface SlotRegistry {
  /**
   * Declares a region's slots until the returned function is called. In
   * development, warns once about each slot id that isn't kebab-case, and
   * about region or slot ids that another mounted region declares too.
   */
  readonly declare: (
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
  const declarations = new Set<Declaration>()
  const owners = new Map<string, Declaration[]>()
  const listeners = new Map<string, Set<() => void>>()
  const warned = new Set<string>()

  function warnOnce(message: string) {
    if (!warned.has(message)) {
      warned.add(message)
      console.warn(message)
    }
  }

  function getContent(id: string) {
    const [owner] = owners.get(id) ?? []
    return owner?.slots[id]
  }

  function update(ids: readonly string[], change: () => void) {
    const before = ids.map(getContent)
    change()
    ids.forEach((id, index) => {
      if (!Object.is(before[index], getContent(id))) {
        for (const listener of listeners.get(id) ?? []) {
          listener()
        }
      }
    })
  }

  function check({ region, slots }: Declaration) {
    for (const other of declarations) {
      if (other.region === region) {
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
      const [owner] = owners.get(id) ?? []
      if (owner) {
        warnOnce(
          `Pliant: regions "${owner.region}" and "${region}" both declare a slot "${id}". Slot ids must be unique within a surface.`
        )
      }
    }
  }

  function declare(region: string, slots: Readonly<Record<string, ReactNode>>) {
    const declaration: Declaration = { region, slots }
    const ids = Object.keys(slots)
    if (isDevelopment) {
      check(declaration)
    }
    update(ids, () => {
      declarations.add(declaration)
      for (const id of ids) {
        owners.set(id, [...(owners.get(id) ?? []), declaration])
      }
    })
    return () => {
      update(ids, () => {
        declarations.delete(declaration)
        for (const id of ids) {
          const rest = (owners.get(id) ?? []).filter(
            (owner) => owner !== declaration
          )
          if (rest.length > 0) {
            owners.set(id, rest)
          } else {
            owners.delete(id)
          }
        }
      })
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
