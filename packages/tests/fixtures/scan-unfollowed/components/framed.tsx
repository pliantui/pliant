import type * as React from "react"

import { panel } from "@/components/panel"

function withPanel(Inner: React.ComponentType) {
  return function WithPanel() {
    return (
      <div>
        {panel}
        <Inner />
      </div>
    )
  }
}

function Plain() {
  return <p>Plain</p>
}

export const Framed = withPanel(Plain)
