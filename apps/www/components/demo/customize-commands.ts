"use client"

import * as React from "react"

import type { PliantCustomizeActions } from "@/registry/pliant/pliant-customize-menu"

// The page-wide Customize menu of the demo on the page, if there is one, so
// the site's command menu can offer the same items. Only one is shown at a
// time: the one registered last.
let current: PliantCustomizeActions | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function set(next: PliantCustomizeActions | null) {
  current = next
  for (const listener of listeners) listener()
}

export function useCustomizeCommands() {
  return React.useSyncExternalStore(
    subscribe,
    () => current,
    () => null
  )
}

// Offers `actions` in the command menu while the calling component is
// mounted. The latest handlers are read when an item runs.
export function useRegisterCustomizeCommands(
  actions: PliantCustomizeActions | undefined
) {
  const latest = React.useRef(actions)
  React.useEffect(() => {
    latest.current = actions
  })
  const enabled = actions !== undefined
  const has = {
    ask: actions?.onAsk !== undefined,
    adjust: actions?.onAdjust !== undefined,
    history: actions?.onHistory !== undefined,
    canReset: actions?.canReset ?? true,
  }
  const { ask, adjust, history, canReset } = has
  React.useEffect(() => {
    if (!enabled) return
    const entry: PliantCustomizeActions = {
      onAsk: ask ? () => latest.current?.onAsk?.() : undefined,
      onAdjust: adjust ? () => latest.current?.onAdjust?.() : undefined,
      onHistory: history ? () => latest.current?.onHistory?.() : undefined,
      onReset: () => latest.current?.onReset?.(),
      canReset,
      unavailable: latest.current?.unavailable,
    }
    set(entry)
    return () => {
      if (current === entry) set(null)
    }
  }, [enabled, ask, adjust, history, canReset])
}
