import { Grid } from "fake-grid"

import { PliantRoot } from "@pliantui/react"

import { MetaBanner } from "@/components/meta-banner"

export default function PackageRenderPropComponentPage() {
  return (
    <PliantRoot surface="package-render-prop-component">
      <Grid render={(grid: unknown) => <MetaBanner table={grid} />} />
    </PliantRoot>
  )
}
