"use client"

import { usePliantStatus, usePliantStore, usePreview } from "@pliantui/react"

import {
  CustomizeControl,
  CustomizeSurface,
} from "@/components/demo/customize-control"
import { useCustomized } from "@/components/demo/use-customized"
import type { ScriptedAsksState } from "@/components/demo/use-scripted-asks"

interface DemoCustomizeOptions {
  // The nodes the menu covers.
  targets: readonly string[]
  // The scripted asks of the demo's mocked parts, which Reset also clears.
  scripted?: ScriptedAsksState | undefined
  onAsk?: (() => void) | undefined
  onAdjust?: (() => void) | undefined
  // Runs after Reset, such as to clear a list of the changes.
  onReset?: (() => void) | undefined
}

// Whether the user changed part of a demo, and the Reset that puts it back.
export function useDemoCustomize({
  targets,
  scripted,
  onAsk,
  onAdjust,
  onReset,
}: DemoCustomizeOptions) {
  const store = usePliantStore()
  const { status } = usePliantStatus()
  const customized = useCustomized(targets)

  return {
    customized: customized || (scripted?.applied.length ?? 0) > 0,
    ready: status === "ready",
    onAsk,
    onAdjust,
    onReset: () => {
      for (const target of targets) store.resetNode(target)
      scripted?.reset()
      onReset?.()
    },
  }
}

// The Customize button for part of a demo, in its header.
export function DemoCustomizeMenu({
  label,
  ref,
  commands,
  askOpen = false,
  ...options
}: DemoCustomizeOptions & {
  // Whether the ask panel is open, showing any preview itself.
  askOpen?: boolean | undefined
  // What the menu customizes, for screen readers, such as "the orders table".
  label: string
  ref?: React.Ref<HTMLButtonElement> | undefined
  // Whether it's the page's menu, which the site's command menu offers too.
  commands?: boolean | undefined
}) {
  const previewing = usePreview() !== null && !askOpen
  return (
    <CustomizeControl
      ref={ref}
      label={label}
      commands={commands}
      previewing={previewing}
      {...useDemoCustomize(options)}
    />
  )
}

// The Customize group in the right-click menu of part of a demo.
export function DemoCustomizeSurface({
  children,
  ...options
}: DemoCustomizeOptions & { children: React.ReactElement }) {
  return (
    <CustomizeSurface {...useDemoCustomize(options)}>
      {children}
    </CustomizeSurface>
  )
}
