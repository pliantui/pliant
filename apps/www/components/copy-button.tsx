"use client"

import { cn } from "cn"
import { CheckIcon, CopyIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"

export function CopyButton({
  value,
  className,
  variant = "ghost",
  ...props
}: React.ComponentProps<typeof Button> & {
  value: string
}) {
  const { isCopied, copyToClipboard } = useCopyToClipboard()

  return (
    <Button
      data-slot="copy-button"
      data-copied={isCopied}
      size="icon"
      variant={variant}
      className={cn(
        "absolute top-3 right-2 z-10 size-7 bg-code hover:opacity-100 focus-visible:opacity-100",
        className
      )}
      onClick={() => {
        void copyToClipboard(value)
      }}
      {...props}
    >
      <span className="sr-only">{isCopied ? "Copied" : "Copy"}</span>
      {isCopied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  )
}
