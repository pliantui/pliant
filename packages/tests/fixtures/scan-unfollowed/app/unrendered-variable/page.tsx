import { PliantRoot } from "@pliantui/react"

import { Banner } from "@/components/banner"

function Panel() {
  const banner = <Banner />
  return <div>{[banner].map((item) => item)}</div>
}

export default function UnrenderedVariablePage() {
  return (
    <PliantRoot surface="unrendered-variable">
      <Panel />
    </PliantRoot>
  )
}
