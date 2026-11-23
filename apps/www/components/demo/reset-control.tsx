import { RotateCcwIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { UnfinishedDot } from "@/components/unfinished-dot"

// The Customized badge and Reset button every demo shows. Reset stays
// focusable when there's nothing to reset, so focus doesn't fall back to
// the page after a reset.
export function ResetControl({
  customized,
  ready = true,
  label,
  onReset,
}: {
  customized: boolean
  // Whether Reset can run yet, such as once the layers have loaded.
  ready?: boolean
  // What Reset puts back, for screen readers, such as "the orders table".
  label: string
  onReset: () => void
}) {
  const inactive = !customized || !ready

  return (
    <div className="flex items-center gap-2">
      {customized && (
        <span className="flex items-center gap-1.5">
          <Badge variant="secondary">Customized</Badge>
          <UnfinishedDot />
        </span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-disabled={inactive}
        aria-label={`Reset ${label}`}
        className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
        onClick={() => {
          if (!inactive) onReset()
        }}
      >
        <RotateCcwIcon />
        Reset
      </Button>
    </div>
  )
}
