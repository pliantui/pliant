import type { StorageAdapter, StoredOverlay } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"

import { memoryAdapter } from "@/lib/demo/memory-adapter"

export const personas = {
  you: {
    label: "You",
    description:
      "The Support team's default, with your own changes on top. Reset drops only your changes.",
  },
  team: {
    label: "Your team",
    description:
      "What everyone in Support starts from. Changes you make here aren't kept.",
  },
  admin: {
    label: "Admin",
    description:
      "The team's default, as the admin who locked Settings sees it. Changes you make here aren't kept.",
  },
} as const

export type Persona = keyof typeof personas

export function isPersona(value: string): value is Persona {
  return Object.hasOwn(personas, value)
}

const surface = "app-shell"
const publishedAt = "2026-11-02T09:30:00.000Z"

// The default the Support team's lead published for the team's sidebar.
const teamDefault: StoredOverlay = {
  overlay: {
    v: 1,
    id: "01KAB0000000000000000TEAM1",
    surface,
    layer: "team",
    scope: { team: "support" },
    ops: [
      { op: "move", target: "app-sidebar/items/tickets", to: { index: 0 } },
    ],
    explain: ["Moved Tickets to the top."],
    basis: { contract: 1, core: "0.0.0", manifests: {} },
    source: "manual",
    createdBy: "priya@saffronsupply.example",
    createdAt: publishedAt,
  },
  etag: "team-1",
  version: 1,
  updatedAt: publishedAt,
}

export const teamDefaultChanges = teamDefault.overlay.explain ?? []

// The layers each persona sees: the team's default for everyone, and the
// user's own changes, kept in this browser, only for "You".
export function storageFor(persona: Persona): () => StorageAdapter {
  if (persona !== "you") return memoryAdapter({ team: [teamDefault] })
  return () => {
    const local = localAdapter()
    return {
      ...local,
      load: async (name) => ({
        ...(await local.load(name)),
        team: [teamDefault],
      }),
    }
  }
}
