import { lazy } from "react"

import { PliantRoot } from "@pliantui/react"

const Lazy = lazy(() => import("@/components/memo-banner"))

export default function LazyMemoPage() {
  return (
    <PliantRoot surface="lazy-memo">
      <Lazy />
    </PliantRoot>
  )
}
