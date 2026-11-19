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

/** Sets our ref and the caller's to the same element. */
export function composeRef<TElement>(
  theirs: Ref<TElement> | undefined,
  ours: RefObject<TElement | null>
) {
  return (element: TElement | null) => {
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
