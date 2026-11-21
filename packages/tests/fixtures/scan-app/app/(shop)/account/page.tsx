import * as React from "react"

import { PliantRegion } from "@/components/pliant/pliant-region"

function withAuth<P extends object>(Page: React.ComponentType<P>) {
  return Page
}

export default withAuth(function AccountPage() {
  return <PliantRegion id="account" slots={{ orders: <p>Orders</p> }} />
})
