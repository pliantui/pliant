import { Box } from "fake-box"

import { PliantRoot } from "@pliantui/react"

import { panel } from "@/components/panel"

export default function ConstantInPackagePropPage() {
  return (
    <PliantRoot surface="constant-in-package-prop">
      <Box render={() => panel} />
    </PliantRoot>
  )
}
