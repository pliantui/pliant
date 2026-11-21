import { readdir } from "node:fs/promises"
import path from "node:path"

import type { Check } from "./check"

const pliantFile = /^(pliant-[a-z0-9-]+)\.[jt]sx?$/

/** The Pliant components copied from the registry into the project. */
export async function checkComponents(
  cwd: string,
  components: string | null
): Promise<Check> {
  if (!components) {
    return {
      name: "components",
      status: "warn",
      message:
        "The components alias in components.json doesn't resolve, so Pliant's components can't be found.",
      fix: "Configure path aliases in tsconfig.json for the components alias.",
    }
  }
  const directory = path.join(components, "pliant")
  const relative = path.relative(cwd, directory) || "."
  let entries: string[] = []
  try {
    entries = await readdir(directory)
  } catch {
    // A missing folder means no components were added.
  }
  const found = entries
    .map((entry) => pliantFile.exec(entry)?.[1])
    .filter((name) => name !== undefined)
    .sort()
  if (found.length === 0) {
    return {
      name: "components",
      status: "warn",
      message: `No Pliant components found in ${relative}.`,
      fix: "Run npx pliantui init to add pliant-region.",
    }
  }
  return {
    name: "components",
    status: "pass",
    message: `Found ${found.join(", ")} in ${relative}.`,
  }
}
