import * as React from "react"

import { PliantRoot } from "@pliantui/react"

import { renderBanner } from "@/components/helpers"

function List({ render }: { render: () => React.ReactNode }) {
  return <ul>{[1].map(() => render())}</ul>
}

export default function RenderPropPage() {
  return (
    <PliantRoot surface="render-prop">
      <List render={renderBanner} />
    </PliantRoot>
  )
}
