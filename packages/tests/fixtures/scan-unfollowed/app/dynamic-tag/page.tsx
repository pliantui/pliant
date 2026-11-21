import { PliantRoot } from "@pliantui/react"

import { Banner } from "@/components/banner"

function Panel({ framed }: { framed?: boolean }) {
  const Frame = framed ? Banner : "div"
  return <Frame />
}

export default function DynamicTagPage() {
  return (
    <PliantRoot surface="dynamic-tag">
      <Panel framed />
    </PliantRoot>
  )
}
