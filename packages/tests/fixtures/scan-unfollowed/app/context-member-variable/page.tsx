import { useContext } from "react"

import { PliantRoot } from "@pliantui/react"

import { UiContext } from "@/components/ui-context"

function Panel() {
  const Picked = useContext(UiContext).Banner
  return <Picked />
}

export default function ContextMemberVariablePage() {
  return (
    <PliantRoot surface="context-member-variable">
      <Panel />
    </PliantRoot>
  )
}
