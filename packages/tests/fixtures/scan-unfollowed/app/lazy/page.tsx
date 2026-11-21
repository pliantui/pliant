import { lazy } from "react"

import { PliantRoot } from "@pliantui/react"

const Lazy = lazy(() => import("@/components/helpers"))

export default function LazyPage() {
  return (
    <PliantRoot surface="lazy">
      <Lazy />
    </PliantRoot>
  )
}
