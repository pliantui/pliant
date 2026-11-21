import * as React from "react"

import { PliantRoot } from "@pliantui/react"

import { Banner } from "@/components/banner"

function Panel() {
  return React.createElement(Banner)
}

export default function CreateElementPage() {
  return (
    <PliantRoot surface="create-element">
      <Panel />
    </PliantRoot>
  )
}
