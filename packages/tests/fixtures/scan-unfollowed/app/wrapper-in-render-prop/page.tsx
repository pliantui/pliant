import { Loader } from "fake-loader"

import { PliantRoot } from "@pliantui/react"

import { Wrap } from "@/components/panel"

export default function WrapperInRenderPropPage() {
  return (
    <PliantRoot surface="wrapper-in-render-prop">
      <Loader>{() => <Wrap />}</Loader>
    </PliantRoot>
  )
}
