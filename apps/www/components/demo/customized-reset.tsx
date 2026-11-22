"use client"

import { usePliantStatus, usePliantStore } from "@pliantui/react"

import { ResetControl } from "@/components/demo/reset-control"
import type { ScriptedAsksState } from "@/components/demo/scripted-frame"
import { useCustomized } from "@/components/demo/use-customized"

// Shows when the user has changed part of a demo, and puts it back.
export function CustomizedReset({
  targets,
  label,
  scripted,
  onReset,
}: {
  // The nodes this control covers.
  targets: readonly string[]
  // What Reset puts back, for screen readers, such as "the orders table".
  label: string
  // The scripted asks of the demo's mocked parts, which Reset also clears.
  scripted?: ScriptedAsksState | undefined
  // Runs after Reset, such as to clear a list of the changes.
  onReset?: (() => void) | undefined
}) {
  const store = usePliantStore()
  const { status } = usePliantStatus()
  const customized = useCustomized(targets)

  return (
    <ResetControl
      customized={customized || (scripted?.applied.length ?? 0) > 0}
      ready={status === "ready"}
      label={label}
      onReset={() => {
        for (const target of targets) store.resetNode(target)
        scripted?.reset()
        onReset?.()
      }}
    />
  )
}
