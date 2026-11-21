"use client"

import { useState } from "react"

import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"
import { PliantActivity, useRegionSlots } from "@pliantui/react/region"

function Region({ id, label }: { id: string; label: string }) {
  useRegionSlots(id, { [`${id}-title`]: label })
  return <p>{label}</p>
}

export function Orders() {
  const [tab, setTab] = useState<"open" | "closed">("open")
  return (
    <PliantRoot surface="/orders" storage={localAdapter}>
      <button
        type="button"
        onClick={() => {
          setTab(tab === "open" ? "closed" : "open")
        }}
      >
        Switch
      </button>
      <PliantActivity mode={tab === "open" ? "visible" : "hidden"}>
        <Region id="open" label="Open orders" />
      </PliantActivity>
      <PliantActivity mode={tab === "closed" ? "visible" : "hidden"}>
        <Region id="closed" label="Closed orders" />
      </PliantActivity>
    </PliantRoot>
  )
}
