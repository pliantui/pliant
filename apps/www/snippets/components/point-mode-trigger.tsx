// #region trigger
"use client"

import { PliantPointMode } from "@/components/pliant/pliant-point-mode"

import { askTargets } from "../ai/ask-targets"

export function PointMode({ onPick }: { onPick: (id: string) => void }) {
  // No toggle: users hold Alt to point.
  return <PliantPointMode targets={askTargets} onPick={onPick} trigger={null} />
}
// #endregion trigger
