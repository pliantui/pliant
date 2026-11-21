import type { Overlay } from "@pliantui/contract"

const coalesceWindow = 1000

interface SaveQueueOptions {
  readonly write: (overlay: Overlay) => void | Promise<void>
  readonly report: (error: unknown) => void
  readonly now: () => number
}

/**
 * The personal versions waiting to be saved through the storage adapter.
 * The latest change waits `coalesceWindow` for one that replaces it.
 */
export function createSaveQueue({ write, report, now }: SaveQueueOptions) {
  const unsaved = new Map<string, Overlay>()
  const failures = new Map<string, string>()
  let pending:
    | {
        readonly overlay: Overlay
        readonly key: string | undefined
        readonly at: number
      }
    | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  // A version is retried on every flush, but the same failure (such as
  // newer data that will never be overwritten) is reported once until the
  // version saves or fails differently.
  function saveFailed(overlay: Overlay, error: unknown) {
    if (!unsaved.has(overlay.id)) {
      unsaved.set(overlay.id, overlay)
    }
    const key =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    if (failures.get(overlay.id) !== key) {
      failures.set(overlay.id, key)
      report(error)
    }
  }

  function persist() {
    for (const overlay of [...unsaved.values()]) {
      let saved: void | Promise<void>
      try {
        saved = write(overlay)
      } catch (error) {
        saveFailed(overlay, error)
        continue
      }
      unsaved.delete(overlay.id)
      if (saved instanceof Promise) {
        saved.then(
          () => {
            failures.delete(overlay.id)
          },
          (error: unknown) => {
            saveFailed(overlay, error)
          }
        )
      } else {
        failures.delete(overlay.id)
      }
    }
  }

  function flush() {
    clearTimeout(timer)
    timer = undefined
    if (pending) {
      unsaved.set(pending.overlay.id, pending.overlay)
      pending = undefined
    }
    persist()
  }

  /** Saves a version at once. */
  function save(overlay: Overlay) {
    unsaved.set(overlay.id, overlay)
    persist()
  }

  /** Saves a version once no change replaces it within the window. */
  function defer(overlay: Overlay, key: string | undefined) {
    clearTimeout(timer)
    pending = { overlay, key, at: now() }
    timer = setTimeout(flush, coalesceWindow)
  }

  /** The id of the waiting version a change with `key` replaces. */
  function pendingId(key: string) {
    return pending?.key === key && now() - pending.at < coalesceWindow
      ? pending.overlay.id
      : undefined
  }

  /** Stops saving a version that turned out to be stored already. */
  function settle(id: string) {
    unsaved.delete(id)
    failures.delete(id)
  }

  return { flush, save, defer, pendingId, settle }
}
