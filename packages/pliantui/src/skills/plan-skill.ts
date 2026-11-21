import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import type { BundledSkill } from "./bundled-skills"

export interface PlannedFile {
  relativePath: string
  content: Buffer
  status: "new" | "unchanged" | "changed"
}

export async function planSkill(
  skill: BundledSkill,
  destination: string
): Promise<PlannedFile[]> {
  const entries = await readdir(skill.directory, {
    recursive: true,
    withFileTypes: true,
  })
  const files: PlannedFile[] = []
  for (const entry of entries.filter((item) => item.isFile())) {
    const source = path.join(entry.parentPath, entry.name)
    const relativePath = path.relative(skill.directory, source)
    const content = await readFile(source)
    const target = path.join(destination, relativePath)
    const status = !existsSync(target)
      ? "new"
      : content.equals(await readFile(target))
        ? "unchanged"
        : "changed"
    files.push({ relativePath, content, status })
  }
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
}
