"use client"

import * as React from "react"

export interface Config {
  packageManager: "pnpm" | "npm" | "yarn" | "bun"
  installationType: "cli" | "manual"
}

const storageKey = "config"
const defaultConfig: Config = {
  packageManager: "pnpm",
  installationType: "cli",
}
const listeners = new Set<() => void>()

function isConfig(value: unknown): value is Partial<Config> {
  return typeof value === "object" && value !== null
}

let cached: { raw: string | null; config: Config } | undefined
// Used when storage is unavailable, so a choice still holds until reload.
let unstored = defaultConfig

function read(): Config {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(storageKey)
  } catch {
    return unstored
  }
  if (cached?.raw === raw) return cached.config
  let config = defaultConfig
  try {
    const parsed: unknown = raw === null ? null : JSON.parse(raw)
    if (isConfig(parsed)) config = { ...defaultConfig, ...parsed }
  } catch {
    // A malformed entry falls back to the defaults.
  }
  cached = { raw, config }
  return config
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener("storage", onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}

// The reader's package manager and installation choice, kept across pages and
// tabs so every code block follows the last one they picked.
export function useConfig() {
  const config = React.useSyncExternalStore(
    subscribe,
    read,
    () => defaultConfig
  )

  const setConfig = React.useCallback((next: Config) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      unstored = next
    }
    for (const listener of listeners) listener()
  }, [])

  return [config, setConfig] as const
}
