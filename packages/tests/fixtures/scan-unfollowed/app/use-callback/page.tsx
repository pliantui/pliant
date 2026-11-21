import { useCallback } from "react"

import { PliantRoot } from "@pliantui/react"

import { renderBanner } from "@/components/helpers"

function Panel() {
  const render = useCallback(renderBanner, [])
  return <div>{render()}</div>
}

export default function UseCallbackPage() {
  return (
    <PliantRoot surface="use-callback">
      <Panel />
    </PliantRoot>
  )
}
