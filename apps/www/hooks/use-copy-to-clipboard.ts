"use client"

import * as React from "react"

export function useCopyToClipboard({
  timeout = 2000,
}: { timeout?: number } = {}) {
  const [isCopied, setIsCopied] = React.useState(false)

  const copyToClipboard = async (value: string) => {
    if (!value) return false

    try {
      await navigator.clipboard.writeText(value)
    } catch {
      return false
    }

    setIsCopied(true)
    setTimeout(() => {
      setIsCopied(false)
    }, timeout)
    return true
  }

  return { isCopied, copyToClipboard }
}
