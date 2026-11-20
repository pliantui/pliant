import * as P from "@pliantui/react"

import { PliantRegion } from "@/components/pliant/pliant-region"

export default function HelpPage() {
  return (
    <P.PliantRoot surface="help">
      <PliantRegion id="faq" slots={{ shipping: <p>Shipping</p> }} />
    </P.PliantRoot>
  )
}
