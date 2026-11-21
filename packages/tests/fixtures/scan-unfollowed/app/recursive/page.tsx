import * as React from "react"

import { PliantRoot } from "@pliantui/react"

import { Tree } from "@/components/helpers"

function Panel() {
  return React.createElement(Tree, { depth: 1 })
}

export default function RecursivePage() {
  return (
    <PliantRoot surface="recursive">
      <Panel />
    </PliantRoot>
  )
}
