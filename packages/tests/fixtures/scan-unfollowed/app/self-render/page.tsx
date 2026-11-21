import * as React from "react"

import { PliantRoot } from "@pliantui/react"

import { Banner } from "@/components/banner"

function renderLevel(level: number): React.ReactNode {
  return level > 0 ? <div>{renderLevel(level - 1)}</div> : <Banner />
}

export default function SelfRenderPage() {
  return <PliantRoot surface="self-render">{renderLevel(2)}</PliantRoot>
}
