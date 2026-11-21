import { useMemo } from "react"

import { PliantRoot } from "@pliantui/react"

import { Banner } from "@/components/banner"

function Panel() {
  const memoized = useMemo(() => <Banner />, [])
  return <div>{memoized}</div>
}

export default function NamedMemoPage() {
  return (
    <PliantRoot surface="named-memo">
      <Panel />
    </PliantRoot>
  )
}
