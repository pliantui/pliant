import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import * as z from "zod"

import { highlighter } from "../utils/highlighter"

const packageJsonSchema = z.object({
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
})

const frameworks: [dependency: string, name: string][] = [
  ["next", "Next.js"],
  ["@tanstack/react-start", "TanStack Start"],
  ["react-router", "React Router"],
  ["@remix-run/react", "Remix"],
  ["astro", "Astro"],
  ["vite", "Vite"],
]

export type Project =
  | { supported: true; dependencies: Record<string, string> }
  | { supported: false; description: string }

export async function detectProject(cwd: string): Promise<Project> {
  const packageJsonPath = path.join(cwd, "package.json")
  if (!existsSync(packageJsonPath)) {
    throw new Error(
      `No ${highlighter.info("package.json")} found in ${highlighter.info(cwd)}.`
    )
  }
  let raw: unknown
  try {
    raw = JSON.parse(await readFile(packageJsonPath, "utf8"))
  } catch {
    throw new Error(
      `Could not read ${highlighter.info(packageJsonPath)}. Check that it is valid JSON.`
    )
  }
  const parsed = packageJsonSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(
      `Invalid ${highlighter.info("package.json")} in ${highlighter.info(cwd)}.`
    )
  }
  const dependencies = {
    ...parsed.data.devDependencies,
    ...parsed.data.dependencies,
  }

  const framework = frameworks.find(([name]) => name in dependencies)?.[1]
  if (framework === "Next.js") {
    if (
      !existsSync(path.join(cwd, "app")) &&
      !existsSync(path.join(cwd, "src/app"))
    ) {
      return { supported: false, description: "Next.js with the Pages Router" }
    }
    return { supported: true, dependencies }
  }
  return { supported: false, description: framework ?? "This kind of project" }
}
