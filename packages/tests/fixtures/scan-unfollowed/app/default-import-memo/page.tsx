import R from "react"

import { PliantRoot } from "@pliantui/react"

import { Banner } from "@/components/banner"

function Panel() {
  const memoized = R.useMemo(() => [<Banner key="banner" />], [])
  return <div>{memoized}</div>
}

export default function DefaultImportMemoPage() {
  return (
    <PliantRoot surface="default-import-memo">
      <Panel />
    </PliantRoot>
  )
}
