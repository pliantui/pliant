import { existsSync } from "node:fs"
import path from "node:path"

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun"

const lockfiles: [string, PackageManager][] = [
  ["pnpm-lock.yaml", "pnpm"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
  ["npm-shrinkwrap.json", "npm"],
]

// Workspaces keep the lockfile at the root, so the search goes up from the
// project.
export function detectPackageManager(cwd: string): PackageManager {
  let directory = cwd
  for (;;) {
    const found = lockfiles.find(([file]) =>
      existsSync(path.join(directory, file))
    )
    if (found) {
      return found[1]
    }
    const parent = path.dirname(directory)
    if (parent === directory) {
      return "npm"
    }
    directory = parent
  }
}

export function installCommand(packageManager: PackageManager, name: string) {
  return {
    command: packageManager,
    args: [packageManager === "npm" ? "install" : "add", name],
  }
}

export function runnerCommand(packageManager: PackageManager, args: string[]) {
  switch (packageManager) {
    case "pnpm":
      return { command: "pnpm", args: ["dlx", ...args] }
    case "bun":
      return { command: "bunx", args }
    default:
      return { command: "npx", args }
  }
}
