import { PliantRoot } from "@pliantui/react"

import { getComponents } from "@/components/helpers"

function Panel() {
  const { Banner: Picked } = getComponents()
  return <Picked />
}

export default function DestructuredCallPage() {
  return (
    <PliantRoot surface="destructured-call">
      <Panel />
    </PliantRoot>
  )
}
