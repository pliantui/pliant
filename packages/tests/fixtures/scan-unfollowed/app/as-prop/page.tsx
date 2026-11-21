import * as React from "react"

import { PliantRoot } from "@pliantui/react"

import { Banner } from "@/components/banner"

function Slot({ as: As }: { as: React.ComponentType }) {
  return <As />
}

export default function AsPropPage() {
  return (
    <PliantRoot surface="as-prop">
      <Slot as={Banner} />
    </PliantRoot>
  )
}
