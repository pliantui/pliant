import type * as React from "react"
import { Grid } from "fake-grid"

import { PliantRoot } from "@pliantui/react"

export default function PackageRenderPropPage() {
  return (
    <PliantRoot surface="package-render-prop">
      <Grid
        render={(grid: { meta: { Banner: React.ComponentType } }) => (
          <grid.meta.Banner />
        )}
      />
    </PliantRoot>
  )
}
