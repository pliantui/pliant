import { PliantRoot } from "@pliantui/react"

import { UiContext } from "@/components/ui-context"

export default function ContextConsumerPage() {
  return (
    <PliantRoot surface="context-consumer">
      <UiContext.Consumer>{(ui) => <ui.Banner />}</UiContext.Consumer>
    </PliantRoot>
  )
}
