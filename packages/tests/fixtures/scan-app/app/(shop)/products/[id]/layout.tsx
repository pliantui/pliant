import * as React from "react"

import { PliantRegion } from "@/components/pliant/pliant-region"

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <PliantRegion id="product" slots={{ details: children }} />
}
