"use client"

import * as React from "react"

export function useCopyToClipboard({
  timeout = 2000,
}: { timeout?: number } = {}) {
  const [isCopied, setIsCopied] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined)

  React.useEffect(() => {
    return () => {
      clearTimeout(timer.current)
    }
  }, [])

  const copyToClipboard = async (value: string) => {
    if (!value) return false

    try {
      await navigator.clipboard.writeText(value)
    } catch {
      return false
    }

    setIsCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setIsCopied(false)
    }, timeout)
    return true
  }

  return { isCopied, copyToClipboard }
}
