import { existsSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { Command } from "commander"
import { Project } from "ts-morph"
import * as z from "zod"

import type { Manifest } from "@pliantui/contract"

import { buildManifest } from "../manifest/build-manifest"
import {
  applyDecisions,
  readDecisions,
  recordDecisions,
} from "../manifest/decisions"
import type { Diagnostic } from "../manifest/diagnostic"
import { formatSummary } from "../manifest/format-summary"
import { inferComponents } from "../manifest/infer-components"
import type { InferredComponent } from "../manifest/inferred-component"
import { defaultNamespace, namespaceSchema } from "../manifest/namespace"
import { renderManifests } from "../manifest/render-manifests"
import { hasUndecided, reviewComponents } from "../manifest/review"
import { findSourceFiles } from "../utils/find-source-files"
import { getConfig } from "../utils/get-config"
import { handleError } from "../utils/handle-error"
import { highlighter } from "../utils/highlighter"
import { logger } from "../utils/logger"
import { pluralize } from "../utils/pluralize"
import { spinner } from "../utils/spinner"

const manifestOptionsSchema = z.object({
  cwd: z.string(),
  yes: z.boolean(),
  namespace: namespaceSchema.optional(),
})

export const manifest = new Command()
  .name("manifest")
  .description("generate manifests for the components you already have")
  .option("-y, --yes", "skip the review and use the inferred classes.", false)
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .option(
    "-n, --namespace <namespace>",
    `the namespace for component kinds. defaults to the saved one, or ${defaultNamespace}.`
  )
  .action(async (opts: Record<string, unknown>) => {
    let result: "written" | "cancelled"
    try {
      const options = manifestOptionsSchema.parse({
        ...opts,
        cwd: path.resolve(String(opts["cwd"])),
      })
      result = await generateManifests(options)
    } catch (error) {
      handleError(error)
    }
    if (result === "cancelled") {
      logger.info("Review cancelled. Nothing was written.")
      process.exit(0)
    }
  })

async function generateManifests(
  options: z.infer<typeof manifestOptionsSchema>
): Promise<"written" | "cancelled"> {
  const { cwd } = options
  const relative = (file: string) => path.relative(cwd, file) || "."

  if (!existsSync(cwd)) {
    throw new Error(`The path ${highlighter.info(cwd)} does not exist.`)
  }
  const config = await getConfig(cwd)
  if (!config) {
    throw new Error(
      `No ${highlighter.info("components.json")} found in ${highlighter.info(cwd)}. Run ${highlighter.info("npx shadcn@latest init")} to create one, then try again.`
    )
  }
  const { ui, lib } = config.resolvedPaths
  if (!existsSync(ui)) {
    throw new Error(
      `The ui folder ${highlighter.info(relative(ui))} from ${highlighter.info("components.json")} does not exist.`
    )
  }

  const files = await findSourceFiles(ui)
  const reading = spinner(
    `Reading ${pluralize(files.length, "file")} in ${highlighter.info(relative(ui))}.`
  ).start()
  const diagnostics: Diagnostic[] = []
  let inferred: InferredComponent[]
  try {
    const project = new Project({
      tsConfigFilePath: config.tsConfigFilePath,
      skipAddingFilesFromTsConfig: true,
    })
    const sourceFiles = files.map((file) => project.addSourceFileAtPath(file))
    inferred = inferComponents(sourceFiles, diagnostics, cwd)
  } catch (error) {
    reading.fail()
    throw error
  }
  reading.succeed()

  const outputDirectory = path.join(lib, "pliant")
  const decisionsFile = path.join(outputDirectory, "manifest-decisions.json")
  const manifestsFile = path.join(
    outputDirectory,
    `manifests.generated.${config.tsx ? "ts" : "js"}`
  )
  const decisions = await readDecisions(decisionsFile)
  let components = applyDecisions(inferred, decisions)
  const namespace = options.namespace ?? decisions.namespace ?? defaultNamespace
  if (decisions.namespace && decisions.namespace !== namespace) {
    logger.warn(
      `The namespace changes from ${decisions.namespace} to ${namespace}, so every kind changes.`
    )
  }

  if (components.length === 0) {
    logger.warn(
      `No components with variants or default-state props found in ${highlighter.info(relative(ui))}.`
    )
    if (existsSync(manifestsFile)) {
      await writeFile(
        manifestsFile,
        renderManifests({}, path.basename(decisionsFile))
      )
      logger.success(`✔ Cleared ${relative(manifestsFile)}.`)
    }
    return "written"
  }

  logger.log(
    `Found ${pluralize(components.length, "component")} in ${highlighter.info(relative(ui))}:`
  )
  logger.break()
  logger.log(formatSummary(components, diagnostics, cwd))
  logger.break()

  let savedDecisions = false
  if (!options.yes && hasUndecided(components)) {
    if (!process.stdin.isTTY) {
      throw new Error(
        `The review needs an interactive terminal. Run ${highlighter.info("pliantui manifest")} in one, or pass ${highlighter.info("--yes")} to use the inferred classes.`
      )
    }
    const reviewed = await reviewComponents(components)
    if (!reviewed) {
      return "cancelled"
    }
    components = reviewed
    await mkdir(outputDirectory, { recursive: true })
    await writeFile(
      decisionsFile,
      `${JSON.stringify(recordDecisions(decisions, components, namespace), null, 2)}\n`
    )
    savedDecisions = true
  }

  // The namespace is saved so kinds stay the same on later runs. The
  // default needs no file of its own.
  let savedNamespace = false
  if (
    !savedDecisions &&
    decisions.namespace !== namespace &&
    (namespace !== defaultNamespace || existsSync(decisionsFile))
  ) {
    await mkdir(outputDirectory, { recursive: true })
    await writeFile(
      decisionsFile,
      `${JSON.stringify({ namespace, components: decisions.components }, null, 2)}\n`
    )
    savedNamespace = true
  }

  const manifests: Record<string, Manifest> = {}
  for (const component of components) {
    const { manifest, error, rejected, incomplete } = buildManifest(
      component,
      namespace
    )
    if (!manifest) {
      logger.warn(`${component.name} was left out: ${error ?? ""}.`)
      continue
    }
    const { props, defaults } = manifest.capabilities
    const sameKind = Object.entries(manifests).find(
      ([, other]) => other.kind === manifest.kind
    )
    if (sameKind) {
      logger.warn(
        `${component.name} was left out: ${sameKind[0]} already has the kind ${manifest.kind}.`
      )
      continue
    }
    if (props || defaults || component.usesVariants) {
      manifests[component.name] = manifest
    }
    for (const { name, reason } of rejected) {
      logger.warn(`${component.name}'s ${name} was left out: ${reason}.`)
    }
    for (const { name, needs } of incomplete) {
      logger.warn(
        `${component.name}'s ${name} was left out: it needs ${needs} in ${relative(decisionsFile)}.`
      )
    }
  }

  await mkdir(outputDirectory, { recursive: true })
  await writeFile(
    manifestsFile,
    renderManifests(manifests, path.basename(decisionsFile))
  )

  const count = Object.keys(manifests).length
  logger.success(
    `✔ Wrote ${pluralize(count, "manifest")} to ${relative(manifestsFile)}.`
  )
  if (savedDecisions) {
    logger.success(`✔ Saved your decisions to ${relative(decisionsFile)}.`)
  }
  if (savedNamespace) {
    logger.success(
      `✔ Saved the namespace ${namespace} to ${relative(decisionsFile)}.`
    )
  }

  const pendingValues = components.flatMap((component) =>
    component.props.flatMap((prop) =>
      prop.values.filter((value) => value.class === "confirm")
    )
  ).length
  const pendingDefaults = components.flatMap((component) =>
    component.defaults.filter((item) => item.class === "confirm")
  ).length
  if (pendingValues + pendingDefaults > 0) {
    const parts = [
      ...(pendingValues > 0 ? [pluralize(pendingValues, "value")] : []),
      ...(pendingDefaults > 0
        ? [pluralize(pendingDefaults, "default-state prop")]
        : []),
    ]
    logger.info(
      `${parts.join(" and ")} ${pendingValues + pendingDefaults === 1 ? "needs" : "need"} confirmation and ${pendingValues + pendingDefaults === 1 ? "was" : "were"} left out. Run ${highlighter.info("pliantui manifest")} without --yes to review them.`
    )
  }

  return "written"
}
