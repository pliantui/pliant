"use client"

import { useEffect, useState } from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => {
      setCopied(false)
    }, 2000)
    return () => {
      clearTimeout(timeout)
    }
  }, [copied])

  function copy() {
    navigator.clipboard.writeText(command).then(
      () => {
        setCopied(true)
      },
      () => {
        setCopied(false)
      }
    )
  }

  return (
    <div className="flex w-full max-w-md items-center justify-between gap-2 rounded-lg border bg-muted/50 py-1.5 pr-1.5 pl-4">
      <code className="min-w-0 truncate font-mono text-sm">{command}</code>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={copy}
        aria-label="Copy command"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
      <span role="status" className="sr-only">
        {copied ? "Command copied to the clipboard." : ""}
      </span>
    </div>
  )
}
