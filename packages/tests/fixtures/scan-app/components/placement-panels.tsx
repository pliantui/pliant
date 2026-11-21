import { usePliantRegion } from "@pliantui/react"
import { usePliantTable } from "@pliantui/react/table"

import { PliantRegion } from "@/components/pliant/pliant-region"

function Grid({ table }: { table: unknown }) {
  return <table data-ready={Boolean(table)} />
}

export function MixedPanel() {
  const table = usePliantTable(
    { data: [], columns: [{ accessorKey: "name" }], features: {} },
    { id: "mixed-table" }
  )
  const region = usePliantRegion("mixed-region", { m1: <p>M1</p> })
  return (
    <section>
      <PliantRegion id="mixed-banner" slots={{ m0: <p>M0</p> }} />
      {region.entries.map((entry) => (
        <div key={entry.id} />
      ))}
      <Grid table={table} />
    </section>
  )
}

export function TablesPanel() {
  const first = usePliantTable(
    { data: [], columns: [{ accessorKey: "x" }], features: {} },
    { id: "table-one" }
  )
  const second = usePliantTable(
    { data: [], columns: [{ accessorKey: "y" }], features: {} },
    { id: "table-two" }
  )
  return (
    <section>
      <Grid table={second} />
      <PliantRegion id="tables-banner" slots={{ t0: <p>T0</p> }} />
      <Grid table={first} />
    </section>
  )
}

export function NestedPanel() {
  const inner = usePliantRegion("inner-a", { n1: <p>N1</p> })
  const outer = usePliantRegion("inner-b", { n2: <p>N2</p> })
  return (
    <section>
      <PliantRegion
        id="card"
        slots={{
          "card-body": (
            <div>
              {inner.entries.map((entry) => (
                <div key={entry.id} />
              ))}
            </div>
          ),
        }}
      />
      {outer.entries.map((entry) => (
        <div key={entry.id} />
      ))}
    </section>
  )
}
