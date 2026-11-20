import { useTable } from "@tanstack/react-table"

import { PliantRoot } from "@pliantui/react"
import { usePliantTable } from "@pliantui/react/table"

import { PliantRegion } from "@/components/pliant/pliant-region"

const charts = ["sales", "returns"]
const prefix = "chart"

function regionId() {
  return "reports"
}

function ReportsTable({ fields }: { fields: string[] }) {
  const options = usePliantTable(
    {
      data: [],
      columns: fields.map((field) => ({ accessorKey: field })),
      features: {},
    },
    { id: "reports-table" }
  )
  const table = useTable(options)
  return <table>{table.getRowCount()}</table>
}

export default function ReportsPage({
  extra,
}: {
  extra: Record<string, string>
}) {
  return (
    <PliantRoot surface="reports">
      <PliantRegion
        id="overview"
        slots={{
          [`${prefix}-total`]: <p>Total</p>,
          ...extra,
          summary: <p>Summary</p>,
        }}
      />
      <PliantRegion
        id={regionId()}
        slots={{
          first: <PliantRegion id="nested" slots={{ deep: <p>Deep</p> }} />,
        }}
      />
      {charts.map((chart) => (
        <PliantRegion key={chart} id={chart} slots={{ body: <p>{chart}</p> }} />
      ))}
      <ReportsTable fields={["date", "amount"]} />
    </PliantRoot>
  )
}
