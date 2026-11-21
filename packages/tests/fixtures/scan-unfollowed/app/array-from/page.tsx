import { PliantRoot } from "@pliantui/react"

import { renderRow } from "@/components/helpers"

function Rows({ rows }: { rows: string[] }) {
  return <div>{Array.from(rows, renderRow)}</div>
}

export default function ArrayFromPage() {
  return (
    <PliantRoot surface="array-from">
      <Rows rows={["a"]} />
    </PliantRoot>
  )
}
