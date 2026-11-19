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
 * content stays mounted, so a hidden region's slots and nodes must
 * stay registered.
 */
export interface Retention {
  /**
   * Holds what `scope` and the scopes in it release, until called back.
   * What it held is released on the next `settle`, so a scope lets go once
   * what it shows again has registered again: `PliantActivity` lets go and
   * settles in its layout phase, or when it unmounts.
   */
  readonly hold: (scope: RetainScope) => () => void
  /** Releases, at the next microtask, what no scope holds any more. */
  readonly settle: () => void
  /**
   * Runs `release`: at once outside any scope, else at the next microtask,
   * and only once no scope around `scope` holds it. A scope must take its
   * hold before then, in the same synchronous pass that released.
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

  // React cleans up what Activity hides and runs PliantActivity's insertion
  // effect in one synchronous pass, so a microtask sees the hold.
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
        }
      }
    },
    settle: schedule,
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
