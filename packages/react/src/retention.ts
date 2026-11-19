/**
 * A part of the tree that a `PliantActivity` can hide, nested in the scope of
 * the nearest `PliantActivity` above it.
 */
export interface RetainScope {
  readonly parent: RetainScope | null
  held: number
}

/**
 * Keeps what a hidden part of the tree registered. React's `Activity`
 * cleans up the effects of what it hides, as if it unmounted, but hidden
 * content stays mounted (spec 7), so a hidden region's slots and nodes must
 * stay registered.
 */
export interface Retention {
  /** Holds what `scope` and the scopes in it release, until called back. */
  readonly hold: (scope: RetainScope) => () => void
  /**
   * Runs `release`: at once outside any scope, else after the current
   * commit, and only once no scope around `scope` holds it.
   */
  readonly release: (scope: RetainScope | null, release: () => void) => void
}

interface Waiting {
  readonly scope: RetainScope
  readonly release: () => void
}

function isHeld(scope: RetainScope | null) {
  for (let current = scope; current; current = current.parent) {
    if (current.held > 0) {
      return true
    }
  }
  return false
}

export function createRetention(): Retention {
  const waiting = new Set<Waiting>()
  let scheduled = false

  // A scope's hold is set in a layout effect, after React cleaned up the
  // effects it hides, so releases wait for the end of the commit.
  function settle() {
    scheduled = false
    for (const entry of waiting) {
      if (!isHeld(entry.scope)) {
        waiting.delete(entry)
        entry.release()
      }
    }
  }

  function schedule() {
    if (!scheduled) {
      scheduled = true
      queueMicrotask(settle)
    }
  }

  return {
    hold(scope) {
      scope.held++
      let holding = true
      return () => {
        if (holding) {
          holding = false
          scope.held--
          schedule()
        }
      }
    },
    release(scope, release) {
      if (scope === null) {
        release()
      } else {
        waiting.add({ scope, release })
        schedule()
      }
    },
  }
}
