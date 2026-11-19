interface NodeRegistry {
  /** The mounted ids as of the last update. */
  readonly ids: () => readonly string[]
  /** Applies a batched update now, so validation sees the latest mounts. */
  readonly sync: () => void
  /** Counts `ids` as mounted until the returned function is called. */
  readonly register: (ids: readonly string[]) => () => void
}

/**
 * Tracks the ids of the nodes mounted on a surface, which ops are validated
 * and resolved against. Mounts and unmounts are batched to a microtask, and
 * `onChange` is called when the ids change.
 */
export function createNodeRegistry(onChange: () => void): NodeRegistry {
  const mounted = new Map<string, number>()
  let mountedIds: readonly string[] = []
  let scheduled = false

  function update() {
    scheduled = false
    const current = new Set(mountedIds)
    if (
      mounted.size !== current.size ||
      [...mounted.keys()].some((id) => !current.has(id))
    ) {
      mountedIds = [...mounted.keys()]
      onChange()
    }
  }

  function sync() {
    if (scheduled) {
      update()
    }
  }

  function schedule() {
    if (!scheduled) {
      scheduled = true
      queueMicrotask(sync)
    }
  }

  return {
    ids: () => mountedIds,
    sync,
    register(ids) {
      for (const id of ids) {
        mounted.set(id, (mounted.get(id) ?? 0) + 1)
      }
      schedule()
      let registered = true
      return () => {
        if (!registered) {
          return
        }
        registered = false
        for (const id of ids) {
          const count = mounted.get(id) ?? 0
          if (count > 1) {
            mounted.set(id, count - 1)
          } else {
            mounted.delete(id)
          }
        }
        schedule()
      }
    },
  }
}
