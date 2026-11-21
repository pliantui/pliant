import { Loader } from "fake-loader"

import { PliantRoot } from "@pliantui/react"

import { Framed } from "@/components/framed"

export default function WrapperInPackagePage() {
  return (
    <PliantRoot surface="wrapper-in-package">
      <Loader>{() => <Framed />}</Loader>
    </PliantRoot>
  )
}
