// #region trigger
import { PliantAskPanel } from "@/components/pliant/pliant-ask-panel"
import { Button } from "@/components/ui/button"

import { askTargets } from "../ai/ask-targets"

export function CustomizeButton() {
  return (
    <PliantAskPanel
      endpoint="/api/pliant"
      targets={askTargets}
      trigger={<Button variant="ghost">Customize</Button>}
    />
  )
}
// #endregion trigger
