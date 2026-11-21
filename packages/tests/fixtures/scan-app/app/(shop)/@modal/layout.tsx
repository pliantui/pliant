import * as React from "react"

import { PliantRegion } from "@/components/pliant/pliant-region"

export default function ModalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PliantRegion id="modal-frame" slots={{ content: <div>{children}</div> }} />
  )
}
