"use client"

import { focusFirstAsk } from "@/components/demo/customize-control"
import { DemoCustomizeMenu } from "@/components/demo/demo-customize"

// The Customize menu in an example page's header, for the whole page. Ask
// moves focus to the page's first suggested asks, and the site's command
// menu offers the same items.
export function PageCustomizeMenu({
  targets,
  label,
  asks = true,
}: {
  targets: readonly string[]
  label: string
  // Whether the page has suggested asks for Ask to move focus to.
  asks?: boolean
}) {
  return (
    <DemoCustomizeMenu
      targets={targets}
      label={label}
      commands
      onAsk={
        asks
          ? () => {
              focusFirstAsk(document.getElementById("main"))
            }
          : undefined
      }
    />
  )
}
