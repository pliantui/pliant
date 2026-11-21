"use client"

import * as React from "react"

import { usePliantNodeProps } from "@pliantui/react"
import { usePliantRegion } from "@pliantui/react/region"

function PliantRegion({
  id,
  slots,
  ...props
}: Omit<React.ComponentProps<"div">, "id" | "children"> & {
  id: string
  slots: Readonly<Record<string, React.ReactNode>>
}) {
  const node = usePliantNodeProps(id)
  const region = usePliantRegion(id, slots)
  return (
    <div {...props} {...node}>
      {region.entries.map((entry) => (
        <div key={entry.id} data-pliant-id={entry.id}>
          {slots[entry.id]}
        </div>
      ))}
    </div>
  )
}

export { PliantRegion }
