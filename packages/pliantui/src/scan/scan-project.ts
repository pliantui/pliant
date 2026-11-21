import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { Project } from "ts-morph"

import { isSourceFile } from "../utils/find-source-files"
import type { Config } from "../utils/get-config"
import { buildInventory } from "./build-inventory"
import { readManifests } from "./read-manifests"
import { renderInventory } from "./render-inventory"
import { scanSurfaces } from "./scan-surfaces"

/**
 * Scans the app's source for its surfaces and compares the inventory they
 * make with the one saved in the `pliant` folder of the `lib` alias.
 */
export async function scanProject(cwd: string, config: Config) {
  const { ui, lib } = config.resolvedPaths
  const outputDirectory = path.join(lib, "pliant")
  const extension = config.tsx ? "ts" : "js"
  const inventoryFile = path.join(
    outputDirectory,
    `inventory.generated.${extension}`
  )

  const project = new Project({ tsConfigFilePath: config.tsConfigFilePath })
  const sourceFiles = project.getSourceFiles().filter((sourceFile) => {
    const file = sourceFile.getFilePath()
    return (
      isSourceFile(file) &&
      !path
        .relative(cwd, file)
        .split(path.sep)
        .some((part) => part.startsWith(".")) &&
      path.dirname(file) !== outputDirectory
    )
  })
  const manifests = readManifests(
    project,
    path.join(outputDirectory, `manifests.generated.${extension}`)
  )
  const { surfaces, report } = scanSurfaces(sourceFiles, {
    manifests,
    ui,
    root: cwd,
  })

  const inventory = buildInventory(surfaces)
  const rendered = renderInventory(inventory, config.tsx)
  const saved = existsSync(inventoryFile)
    ? await readFile(inventoryFile, "utf8")
    : undefined

  return {
    sourceFiles,
    surfaces,
    report,
    inventory,
    inventoryFile,
    outputDirectory,
    rendered,
    saved,
    upToDate: saved === rendered,
  }
}
