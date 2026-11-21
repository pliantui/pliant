import { useContext } from "react"

import { PliantRoot } from "@pliantui/react"

import { UiContext } from "@/components/ui-context"

function Panel() {
  const ui = useContext(UiContext)
  return <ui.Banner />
}

export default function ContextMemberPage() {
  return (
    <PliantRoot surface="context-member">
      <Panel />
    </PliantRoot>
  )
}
