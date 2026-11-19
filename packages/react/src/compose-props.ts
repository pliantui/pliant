import type { Ref, RefObject, SyntheticEvent } from "react"

/**
 * Runs the caller's handler first, then ours unless the caller called
 * `event.preventDefault()`.
 */
export function composeHandler<TEvent extends SyntheticEvent>(
  theirs: ((event: TEvent) => void) | undefined,
  ours: (event: TEvent) => void
) {
  return (event: TEvent) => {
    theirs?.(event)
    if (!event.defaultPrevented) {
      ours(event)
    }
  }
}

type RefCallback<TElement> = (
  element: TElement | null
) => (() => void) | undefined

// Composed refs are cached by both refs, so the same pair gives the same
// callback on every render, and React doesn't detach and reattach it.
const composed = new WeakMap<object, WeakMap<object, unknown>>()
const alone = new WeakMap<object, RefCallback<Element>>()

function compose<TElement extends Element>(
  theirs: Ref<TElement> | undefined,
  ours: RefObject<Element | null>
): RefCallback<TElement> {
  return (element) => {
    ours.current = element
    if (typeof theirs === "function") {
      const cleanup = theirs(element)
      return typeof cleanup === "function"
        ? () => {
            ours.current = null
            cleanup()
          }
        : undefined
    }
    if (theirs) {
      theirs.current = element
    }
    return undefined
  }
}

/** Sets our ref and the caller's to the same element. */
export function composeRef<TElement extends Element>(
  theirs: Ref<TElement> | undefined,
  ours: RefObject<Element | null>
): RefCallback<TElement> {
  if (!theirs) {
    let callback = alone.get(ours)
    if (!callback) {
      callback = compose(undefined, ours)
      alone.set(ours, callback)
    }
    return callback
  }
  let byTheirs = composed.get(ours)
  if (!byTheirs) {
    byTheirs = new WeakMap()
    composed.set(ours, byTheirs)
  }
  const cached = byTheirs.get(theirs)
  if (cached) {
    // Made below for this same `theirs`, so for its element type.
    return cached as RefCallback<TElement>
  }
  const callback = compose(theirs, ours)
  byTheirs.set(theirs, callback)
  return callback
}
