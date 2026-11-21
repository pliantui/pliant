import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { parseFrontmatter } from "./frontmatter"

export interface BundledSkill {
  name: string
  description: string
  directory: string
}

// The CLI runs from dist/index.js, and its tests from src, so the skills
// folder is found next to the package.json above this file.
function bundledDirectory() {
  let directory = path.dirname(fileURLToPath(import.meta.url))
  while (!existsSync(path.join(directory, "package.json"))) {
    const parent = path.dirname(directory)
    if (parent === directory) {
      throw new Error("Could not find the pliantui package.")
    }
    directory = parent
  }
  return path.join(directory, "skills")
}

export async function readBundledSkills(): Promise<BundledSkill[]> {
  const root = bundledDirectory()
  const entries = await readdir(root, { withFileTypes: true })
  const skills: BundledSkill[] = []
  for (const entry of entries.filter((item) => item.isDirectory())) {
    const directory = path.join(root, entry.name)
    const { description } = parseFrontmatter(
      await readFile(path.join(directory, "SKILL.md"), "utf8")
    )
    skills.push({ name: entry.name, description, directory })
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name))
}
