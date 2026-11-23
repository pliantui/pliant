// #region trigger
"use client"

import { SquareDashedMousePointerIcon } from "lucide-react"

import { PliantPointMode } from "@/components/pliant/pliant-point-mode"
import { Button } from "@/components/ui/button"

import { askTargets } from "../ai/ask-targets"

export function PointMode() {
  return (
    <PliantPointMode
      targets={askTargets}
      trigger={
        <Button variant="outline" size="sm">
          <SquareDashedMousePointerIcon />
          Select
        </Button>
      }
    />
  )
}
// #endregion trigger
