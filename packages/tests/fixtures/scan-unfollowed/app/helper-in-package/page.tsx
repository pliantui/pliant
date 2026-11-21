import { Loader } from "fake-loader"

import { PliantRoot } from "@pliantui/react"

import { Banner } from "@/components/banner"
import { renderHidden } from "@/components/hidden-region"

export default function HelperInPackagePage() {
  return (
    <PliantRoot surface="helper-in-package">
      <Banner />
      <Loader>{renderHidden}</Loader>
    </PliantRoot>
  )
}
