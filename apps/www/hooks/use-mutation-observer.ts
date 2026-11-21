import * as React from "react"

const defaultOptions: MutationObserverInit = {
  attributes: true,
  characterData: true,
  childList: true,
  subtree: true,
}

export function useMutationObserver(
  ref: React.RefObject<HTMLElement | null>,
  callback: MutationCallback,
  options: MutationObserverInit = defaultOptions
) {
  React.useEffect(() => {
    if (!ref.current) return
    const observer = new MutationObserver(callback)
    observer.observe(ref.current, options)
    return () => {
      observer.disconnect()
    }
  }, [ref, callback, options])
}
