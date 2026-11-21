import type * as React from "react"

import { PliantRoot } from "@pliantui/react"

import { panel } from "@/components/panel"

const withPanel = (Inner: React.ComponentType) => () => (
  <div>
    {panel}
    <Inner />
  </div>
)

function Plain() {
  return <p>Plain</p>
}

const Framed = withPanel(Plain)

export default function WrapperAddsPage() {
  return (
    <PliantRoot surface="wrapper-adds">
      <Framed />
    </PliantRoot>
  )
}
