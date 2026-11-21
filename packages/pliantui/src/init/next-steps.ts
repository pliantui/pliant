export const docsUrl = "https://pliantui.dev/docs"

export const pageSnippet = `import { PliantRoot } from "@pliantui/react"
import { PliantPrePaint } from "@pliantui/react/pre-paint"

import { PliantRegion } from "@/components/pliant/pliant-region"

const surface = "/orders/[id]" // this page's route pattern

export default function Page() {
  return (
    <PliantRoot surface={surface}>
      <PliantPrePaint surface={surface} />
      <PliantRegion
        id="summary"
        slots={{ total: <OrderTotal />, status: <OrderStatus /> }}
      />
    </PliantRoot>
  )
}`
