import { PliantRegion } from "@/components/pliant/pliant-region"
import { useTwoRegions } from "@/hooks/use-two-regions"

export function TwoPanel() {
  const both = useTwoRegions()
  return (
    <section>
      {both.a.entries.map((entry) => (
        <div key={entry.id} />
      ))}
      <PliantRegion id="two-banner" slots={{ notice: <p>Notice</p> }} />
      {both.b.entries.map((entry) => (
        <div key={entry.id} />
      ))}
    </section>
  )
}
