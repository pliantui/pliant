import { PliantRoot } from "@pliantui/react"

import { Banner } from "@/components/banner"

function pick() {
  return Banner
}

function Panel() {
  const Picked = pick()
  return <Picked />
}

export default function FactoryCallPage() {
  return (
    <PliantRoot surface="factory-call">
      <Panel />
    </PliantRoot>
  )
}
