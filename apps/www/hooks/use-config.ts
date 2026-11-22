"use client"

import * as React from "react"

export interface Config {
  packageManager: "pnpm" | "npm" | "yarn" | "bun"
  installationType: "cli" | "manual"
}

const storageKey = "pliant-docs-config"
const defaultConfig: Config = {
  packageManager: "pnpm",
  installationType: "cli",
}
const listeners = new Set<() => void>()

const packageManagers: readonly Config["packageManager"][] = [
  "pnpm",
  "npm",
  "yarn",
  "bun",
]
const installationTypes: readonly Config["installationType"][] = [
  "cli",
  "manual",
]

function pick<T extends string>(
  allowed: readonly T[],
  value: unknown,
  fallback: T
): T {
  return allowed.find((item) => item === value) ?? fallback
}

function parse(raw: string | null): Config {
  let stored: unknown = null
  try {
    stored = raw === null ? null : JSON.parse(raw)
  } catch {
    return defaultConfig
  }
  if (typeof stored !== "object" || stored === null) return defaultConfig
  return {
    packageManager: pick(
      packageManagers,
      "packageManager" in stored ? stored.packageManager : undefined,
      defaultConfig.packageManager
    ),
    installationType: pick(
      installationTypes,
      "installationType" in stored ? stored.installationType : undefined,
      defaultConfig.installationType
    ),
  }
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
  const config = parse(raw)
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
