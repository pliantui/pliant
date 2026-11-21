import { PliantRegion } from "@/components/pliant/pliant-region"
import { ShellLayout } from "@/components/shell/layout"

export function Home() {
  return (
    <ShellLayout>
      <PliantRegion id="home" slots={{ welcome: <p>Welcome</p> }} />
    </ShellLayout>
  )
}
