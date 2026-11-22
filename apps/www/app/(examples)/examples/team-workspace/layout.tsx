import { inventory } from "@/lib/pliant/inventory.generated"

import { TeamWorkspaceShell } from "./components/team-workspace-shell"

export default function AppExampleLayout({
  children,
}: LayoutProps<"/examples/team-workspace">) {
  return (
    <TeamWorkspaceShell inventory={inventory["app-shell"]}>
      {children}
    </TeamWorkspaceShell>
  )
}
