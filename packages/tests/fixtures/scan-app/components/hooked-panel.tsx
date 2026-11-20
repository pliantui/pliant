import { PliantRegion } from "@/components/pliant/pliant-region"
import * as hooks from "@/hooks/use-hooked-region"

export function HookedPanel() {
  const { entries } = hooks.useHookedRegion()
  return (
    <section>
      {entries.map((entry) => (
        <div key={entry.id} />
      ))}
      <PliantRegion id="hooked-footer" slots={{ note: <p>Note</p> }} />
    </section>
  )
}
