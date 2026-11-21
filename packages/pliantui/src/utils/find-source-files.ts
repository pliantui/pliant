import { readdir } from "node:fs/promises"
import path from "node:path"

const ignoredFile = /\.(d|test|spec|stories)\.[cm]?[jt]sx?$/

/**
 * Whether a file is app source: a script that isn't a test, a story or a
 * type declaration, outside `node_modules`.
 */
export function isSourceFile(file: string) {
  const name = path.basename(file)
  return (
    /\.[cm]?[jt]sx?$/.test(name) &&
    !ignoredFile.test(name) &&
    !file.split(path.sep).includes("node_modules")
  )
}

export async function findSourceFiles(directory: string) {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter(isSourceFile)
    .sort()
}
