import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import * as z from "zod"

const packageManagers = ["npm", "pnpm", "yarn", "bun"] as const

export type PackageManager = (typeof packageManagers)[number]

const lockfiles: [string, PackageManager][] = [
  ["pnpm-lock.yaml", "pnpm"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
  ["npm-shrinkwrap.json", "npm"],
]

// Workspaces keep the lockfile and the packageManager field at the root, so
// both searches go up from the project. A lockfile wins over the field.
export async function detectPackageManager(
  cwd: string
): Promise<PackageManager> {
  const directories = ancestors(cwd)
  for (const directory of directories) {
    const found = lockfiles.find(([file]) =>
      existsSync(path.join(directory, file))
    )
    if (found) {
      return found[1]
    }
  }
  for (const directory of directories) {
    const declared = await readPackageManagerField(directory)
    if (declared) {
      return declared
    }
  }
  return "npm"
}

function ancestors(cwd: string) {
  const directories = [cwd]
  for (let directory = cwd; path.dirname(directory) !== directory;) {
    directory = path.dirname(directory)
    directories.push(directory)
  }
  return directories
}

async function readPackageManagerField(directory: string) {
  try {
    const raw: unknown = JSON.parse(
      await readFile(path.join(directory, "package.json"), "utf8")
    )
    const parsed = z.object({ packageManager: z.string() }).safeParse(raw)
    if (!parsed.success) {
      return undefined
    }
    const [name] = parsed.data.packageManager.split("@")
    return packageManagers.find((packageManager) => packageManager === name)
  } catch {
    return undefined
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
