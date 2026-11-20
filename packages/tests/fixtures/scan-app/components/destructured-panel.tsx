import { usePliantRegion } from "@pliantui/react"

import { PliantRegion } from "@/components/pliant/pliant-region"

export function DestructuredPanel() {
  const { entries } = usePliantRegion("destructured", {
    d1: <p>D1</p>,
    d2: <p>D2</p>,
  })
  return (
    <section>
      {entries.map((entry) => (
        <div key={entry.id} />
      ))}
      <PliantRegion id="destructured-footer" slots={{ end: <p>End</p> }} />
    </section>
  )
}
