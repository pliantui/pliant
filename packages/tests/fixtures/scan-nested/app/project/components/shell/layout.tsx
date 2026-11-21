import * as React from "react"

import { PliantRoot } from "@pliantui/react"

export function ShellLayout({ children }: { children: React.ReactNode }) {
  return <PliantRoot surface="shell">{children}</PliantRoot>
}
