import { PliantRoot } from "@pliantui/react"

import { useBannerComponent } from "@/components/helpers"

function Panel() {
  const Picked = useBannerComponent()
  return <Picked />
}

export default function HookComponentPage() {
  return (
    <PliantRoot surface="hook-component">
      <Panel />
    </PliantRoot>
  )
}
