import * as React from "react"

import { PliantRoot } from "@pliantui/react"

import { PliantRegion } from "@/components/pliant/pliant-region"

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PliantRoot surface="shop">
      <PliantRegion id="shop-header" slots={{ cart: <p>Cart</p> }} />
      <main>{children}</main>
    </PliantRoot>
  )
}
