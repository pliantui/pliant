"use client"

import { usePliantStatus, usePliantStore } from "@pliantui/react"

import { ResetControl } from "@/components/demo/reset-control"
import { useCustomized } from "@/components/demo/use-customized"

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

  return (
    <ResetControl
      customized={useCustomized(targets)}
      ready={status === "ready"}
      label={label}
      onReset={() => {
        for (const target of targets) store.resetNode(target)
      }}
    />
  )
}
