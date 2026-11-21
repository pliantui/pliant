import { existsSync } from "node:fs"
import path from "node:path"

import type { Check } from "./check"

/**
 * Whether the project has manifests. `pliantui manifest` has no check
 * mode, so whether they're up to date isn't checked.
 */
export function checkManifests(
  outputDirectory: string,
  tsx: boolean,
  cwd: string
): Check {
  const file = path.join(
    outputDirectory,
    `manifests.generated.${tsx ? "ts" : "js"}`
  )
  const relative = path.relative(cwd, file)
  return existsSync(file)
    ? {
        name: "manifests",
        status: "skip",
        message: `Found ${relative}. Whether it's up to date isn't checked.`,
        fix: "Run npx pliantui manifest again after you change the components in your ui folder.",
      }
    : {
        name: "manifests",
        status: "skip",
        message: `No ${relative}, so none of your own components have manifests.`,
        fix: "Run npx pliantui manifest to describe your own components.",
      }
}
