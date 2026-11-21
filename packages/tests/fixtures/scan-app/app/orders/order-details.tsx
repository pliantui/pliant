"use client"

import * as React from "react"

import { PliantRegion } from "@/components/pliant/pliant-region"
import { Badge } from "@/components/ui/badge"

export function OrderDetails() {
  const [open, setOpen] = React.useState(false)

  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)}>
        Details
      </button>
      {open && (
        <PliantRegion
          id="shipping"
          slots={{
            address: <p>1 Main Street</p>,
            status: <Badge>Shipped</Badge>,
          }}
        />
      )}
      {open ? (
        <PliantRegion id="billing" slots={{ invoice: <p>Invoice</p> }} />
      ) : null}
    </div>
  )
}
