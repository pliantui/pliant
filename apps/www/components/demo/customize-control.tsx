"use client"

import { useRegisterCustomizeCommands } from "@/components/demo/customize-commands"
import { UnfinishedDot } from "@/components/unfinished-dot"
import {
  PliantCustomizeContextMenu,
  PliantCustomizeMenu,
  type PliantCustomizeActions,
} from "@/registry/pliant/pliant-customize-menu"

interface CustomizeControlOptions {
  // Whether the user has changed the part.
  customized: boolean
  // Whether Reset can run yet, such as once the layers have loaded.
  ready?: boolean | undefined
  onAsk?: (() => void) | undefined
  onAdjust?: (() => void) | undefined
  onReset: () => void
}

// The demos have no history view yet, so History, and any item a demo has
// nothing for, shows the unfinished dot.
export function actionsOf({
  customized,
  ready = true,
  onAsk,
  onAdjust,
  onReset,
}: CustomizeControlOptions): PliantCustomizeActions {
  return {
    onAsk,
    onAdjust,
    onReset,
    canReset: customized && ready,
    unavailable: <UnfinishedDot />,
  }
}

// The Customize button a demo shows in its header.
export function CustomizeControl({
  label,
  ref,
  commands = false,
  previewing = false,
  ...options
}: CustomizeControlOptions & {
  // What the menu customizes, for screen readers, such as "the orders table".
  label: string
  ref?: React.Ref<HTMLButtonElement> | undefined
  // Whether it's the page's menu, which the site's command menu offers too.
  commands?: boolean | undefined
  // Whether a preview shows that the ask panel doesn't, as while it's
  // closed.
  previewing?: boolean | undefined
}) {
  useRegisterCustomizeCommands(commands ? actionsOf(options) : undefined)

  return (
    <PliantCustomizeMenu
      ref={ref}
      aria-label={`Customize ${label}`}
      customized={options.customized}
      previewing={previewing}
      {...actionsOf(options)}
    />
  )
}

// The Customize group in the right-click menu of a demo's live part, and
// ⌘. to ask about it.
export function CustomizeSurface({
  children,
  ...options
}: CustomizeControlOptions & { children: React.ReactElement }) {
  return (
    <PliantCustomizeContextMenu {...actionsOf(options)}>
      {children}
    </PliantCustomizeContextMenu>
  )
}

export type { CustomizeControlOptions }

// Moves focus to the first suggested ask under part of a demo, which stand
// in for the ask panel where a demo has none.
export function focusFirstAsk(container: HTMLElement | null) {
  const asks = container?.querySelector<HTMLElement>(
    '[role="group"][aria-label^="Ask about"]'
  )
  asks?.scrollIntoView({ block: "center", behavior: "smooth" })
  asks?.querySelector("button")?.focus({ preventScroll: true })
}

// Moves focus to the first control of a data table's toolbar, or else its
// columns menu, where the table is adjusted by hand.
export function focusTableControls(container: HTMLElement | null) {
  const control =
    container
      ?.querySelector('[data-slot="pliant-data-table-toolbar"]')
      ?.querySelector<HTMLElement>("input, button:not(:disabled)") ??
    container?.querySelector<HTMLElement>('[data-slot="dropdown-menu-trigger"]')
  control?.scrollIntoView({ block: "center", behavior: "smooth" })
  control?.focus({ preventScroll: true })
}
