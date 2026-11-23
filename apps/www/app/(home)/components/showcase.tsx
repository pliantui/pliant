import { getSectionsQueries } from "@/lib/acme/sections-query"

import { AcmeShowcase } from "./acme/acme-showcase"

// A live dashboard for a fictional company, Acme Inc., built like shadcn's
// dashboard-01 block with Pliant in it. Render it inside the home page's
// `PliantRoot`.
export function Showcase() {
  return (
    <section aria-label="Live demo" className="container-wrapper">
      <div className="container pb-12">
        <AcmeShowcase queries={getSectionsQueries()} />
      </div>
    </section>
  )
}
