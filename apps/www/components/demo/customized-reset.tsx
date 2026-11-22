"use client"

import { RotateCcwIcon } from "lucide-react"

import { usePliantStatus, usePliantStore } from "@pliantui/react"

import { useCustomized } from "@/components/demo/use-customized"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

// Shows when the user has changed part of a demo, and puts it back.
export function CustomizedReset({
  targets,
  label,
}: {
  // The nodes this control covers.
  targets: readonly string[]
  // What Reset puts back, for screen readers, such as "the orders table".
  label: string
}) {
  const store = usePliantStore()
  const { status } = usePliantStatus()
  const customized = useCustomized(targets)

  return (
    <div className="flex items-center gap-2">
      {customized && <Badge variant="secondary">Customized</Badge>}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={!customized || status !== "ready"}
        aria-label={`Reset ${label}`}
        onClick={() => {
          for (const target of targets) store.resetNode(target)
        }}
      >
        <RotateCcwIcon />
        Reset
      </Button>
    </div>
  )
}
