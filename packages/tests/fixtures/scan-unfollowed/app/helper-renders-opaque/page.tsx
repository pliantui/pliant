import { Loader } from "fake-loader"

import { PliantRoot } from "@pliantui/react"

import { renderIt } from "@/components/render-it"

function Section() {
  return <div>{renderIt()}</div>
}

export default function HelperRendersOpaquePage() {
  return (
    <PliantRoot surface="helper-renders-opaque">
      <Loader>{() => <Section />}</Loader>
    </PliantRoot>
  )
}
