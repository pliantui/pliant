import { existsSync } from "node:fs"
import path from "node:path"

// Claude Code reads only `.claude/skills`. Other coding agents read the
// shared `.agents/skills`, so that is where skills go unless the project
// already has a `.claude` folder.
export function skillsDirectory(cwd: string, dir: string | undefined) {
  if (dir) {
    return path.resolve(cwd, dir)
  }
  return existsSync(path.join(cwd, ".claude"))
    ? path.join(cwd, ".claude", "skills")
    : path.join(cwd, ".agents", "skills")
}
