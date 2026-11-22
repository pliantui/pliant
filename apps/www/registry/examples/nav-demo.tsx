import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"

import { WorkspaceSidebar } from "@/app/(home)/components/sidebar-card"
import { DemoFrame } from "@/components/demo/demo-frame"
import { team } from "@/lib/demo/data"

export function NavDemo() {
  return (
    <PliantRoot surface="/docs/components/nav" storage={localAdapter}>
      <DemoFrame
        target="workspace-nav"
        label="support desk sidebar"
        asks={["pin customers to the top", "hide reports"]}
      >
        <div className="mx-auto w-full max-w-64">
          <WorkspaceSidebar
            user={team.find((member) => member.team === "Support")}
          />
        </div>
      </DemoFrame>
    </PliantRoot>
  )
}
