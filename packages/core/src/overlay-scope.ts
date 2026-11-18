import type { WithOps } from "./with-ops"

/** The team id of a team overlay, the org id of an org overlay, else "". */
export function scopeIdOf(overlay: WithOps<unknown>): string {
  switch (overlay.layer) {
    case "org":
      return overlay.scope.org
    case "team":
      return overlay.scope.team
    default:
      return ""
  }
}

/**
 * Identifies who an overlay speaks for: one team, one org, or the user's
 * personal or session layer. Removals and breakpoint merging stay within it.
 */
export function scopeKeyOf(overlay: WithOps<unknown>): string {
  switch (overlay.layer) {
    case "org":
    case "team":
      return `${overlay.layer}:${scopeIdOf(overlay)}`
    default:
      return overlay.layer
  }
}
