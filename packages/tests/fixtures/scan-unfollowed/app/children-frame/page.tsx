import * as React from "react"

import { PliantRoot } from "@pliantui/react"

import { Banner } from "@/components/banner"

function Frame({ children }: { children: React.ReactNode }) {
  return <section>{children}</section>
}

export default function ChildrenFramePage() {
  return (
    <PliantRoot surface="children-frame">
      <Frame>
        <Banner />
      </Frame>
    </PliantRoot>
  )
}
