// #region trigger
"use client"

import { MousePointerClickIcon } from "lucide-react"

import { PliantPointMode } from "@/components/pliant/pliant-point-mode"
import { Button } from "@/components/ui/button"

import { askTargets } from "../ai/ask-targets"

export function PointButton({ onPick }: { onPick: (id: string) => void }) {
  return (
    <PliantPointMode
      targets={askTargets}
      onPick={onPick}
      trigger={
        <Button size="icon" variant="ghost" aria-label="Point">
          <MousePointerClickIcon />
        </Button>
      }
    />
  )
}
// #endregion trigger
