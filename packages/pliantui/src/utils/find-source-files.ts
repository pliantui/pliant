import { readdir } from "node:fs/promises"
import path from "node:path"

const ignoredFile = /\.(d|test|spec|stories)\.[cm]?[jt]sx?$/

export async function findSourceFiles(directory: string) {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  })
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.[cm]?[jt]sx?$/.test(entry.name) &&
        !ignoredFile.test(entry.name)
    )
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((file) => !file.split(path.sep).includes("node_modules"))
    .sort()
}
