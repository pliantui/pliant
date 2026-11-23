"use client"

import { useDemoAsk } from "@/components/demo/demo-ask-panel"
import { DemoCustomizeMenu } from "@/components/demo/demo-customize"

// The Customize menu in an example page's header, for the whole page. Ask
// opens the page's chat, and the site's command menu offers the same
// items. Render it inside the page's `DemoAsk`.
export function PageCustomizeMenu({
  targets,
  label,
}: {
  targets: readonly string[]
  label: string
}) {
  const chat = useDemoAsk()
  return (
    <DemoCustomizeMenu
      targets={targets}
      label={label}
      commands
      onAsk={() => {
        chat?.ask()
      }}
    />
  )
}
