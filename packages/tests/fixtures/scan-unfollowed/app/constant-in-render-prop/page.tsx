import { Loader } from "fake-loader"

import { PliantRoot } from "@pliantui/react"

import { panel } from "@/components/panel"

export default function ConstantInRenderPropPage() {
  return (
    <PliantRoot surface="constant-in-render-prop">
      <Loader>{() => panel}</Loader>
    </PliantRoot>
  )
}
