import { PliantRegion } from "@/components/pliant/pliant-region"
import * as hooks from "@/hooks/use-hooked-region"

export function HookedPanel() {
  const region = hooks.useHookedRegion()
  return (
    <section>
      {region.entries.map((entry) => (
        <div key={entry.id} />
      ))}
      <PliantRegion id="hooked-footer" slots={{ note: <p>Note</p> }} />
    </section>
  )
}
