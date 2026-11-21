import { PliantRoot } from "@pliantui/react"

import AnonymousBanner from "@/components/anonymous-banner"

export default function AnonymousDefaultPage() {
  return (
    <PliantRoot surface="anonymous-default">
      <AnonymousBanner />
    </PliantRoot>
  )
}
