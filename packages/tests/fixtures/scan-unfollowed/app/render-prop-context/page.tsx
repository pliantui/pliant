import { useContext } from "react"

import { PliantRoot } from "@pliantui/react"

import { Loader } from "@/components/loader"
import { UiContext } from "@/components/ui-context"

function Panel() {
  const ui = useContext(UiContext)
  return <Loader>{() => <ui.Banner />}</Loader>
}

export default function RenderPropContextPage() {
  return (
    <PliantRoot surface="render-prop-context">
      <Panel />
    </PliantRoot>
  )
}
