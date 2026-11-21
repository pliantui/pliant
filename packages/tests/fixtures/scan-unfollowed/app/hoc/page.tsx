import { PliantRoot } from "@pliantui/react"

import { Banner } from "@/components/banner"
import { withBox } from "@/components/helpers"

const Boxed = withBox(Banner)

export default function HocPage() {
  return (
    <PliantRoot surface="hoc">
      <Boxed />
    </PliantRoot>
  )
}
