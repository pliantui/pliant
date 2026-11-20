import * as P from "@pliantui/react"

import { DestructuredPanel } from "@/components/destructured-panel"
import { HookedPanel } from "@/components/hooked-panel"
import { PliantRegion } from "@/components/pliant/pliant-region"
import { TwoPanel } from "@/components/two-panel"

export default function HelpPage() {
  return (
    <P.PliantRoot surface="help">
      <PliantRegion id="faq" slots={{ shipping: <p>Shipping</p> }} />
      <HookedPanel />
      <PliantRegion id="panels" slots={{ pair: <TwoPanel /> }} />
      <DestructuredPanel />
    </P.PliantRoot>
  )
}
