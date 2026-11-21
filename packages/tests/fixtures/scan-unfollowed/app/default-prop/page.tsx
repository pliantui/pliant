import type * as React from "react"

import { PliantRoot } from "@pliantui/react"

import { panel } from "@/components/panel"

function Holder({ content = panel }: { content?: React.ReactNode }) {
  return <div>{content}</div>
}

export default function DefaultPropPage() {
  return (
    <PliantRoot surface="default-prop">
      <Holder />
    </PliantRoot>
  )
}
