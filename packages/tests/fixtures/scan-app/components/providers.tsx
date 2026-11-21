import * as React from "react"

import { PliantRoot } from "@pliantui/react"

export function Providers({ children }: { children: React.ReactNode }) {
  return <PliantRoot surface="settings">{children}</PliantRoot>
}
