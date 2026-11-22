import { cn } from "cn"
import { InfoIcon } from "lucide-react"

import { replayNote } from "@/lib/replay/replay-fetch"

export function ReplayNote({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground",
        className
      )}
    >
      <InfoIcon aria-hidden="true" className="size-3.5 shrink-0" />
      {replayNote}
    </p>
  )
}
