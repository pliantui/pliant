import * as React from "react"

import * as Pliant from "@pliantui/react/region"

import { PliantRegion } from "@/components/pliant/pliant-region"

export function FramedPanel({
  slots,
}: {
  slots: Readonly<Record<string, React.ReactNode>>
}) {
  const region = Pliant.usePliantRegion("framed", slots)
  return (
    <section>
      <PliantRegion id="banner" slots={{ message: <p>Message</p> }} />
      {region.entries.map((entry) => (
        <div key={entry.id}>{slots[entry.id]}</div>
      ))}
    </section>
  )
}
