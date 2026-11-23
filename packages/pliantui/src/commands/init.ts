import { existsSync } from "node:fs"
import path from "node:path"
import { Command } from "commander"
import prompts from "prompts"
import * as z from "zod"

import { detectProject } from "../init/detect-project"
import { docsUrl, pageSnippet } from "../init/next-steps"
import {
  detectPackageManager,
  installCommand,
  runnerCommand,
} from "../init/package-manager"
import {
  namespace,
  readPliantRegistry,
  registryTemplate,
  writePliantRegistry,
} from "../init/pliant-registry"
import { parseRegistryUrl } from "../init/registry-url"
import { getConfig } from "../utils/get-config"
import { handleError } from "../utils/handle-error"
import { highlighter } from "../utils/highlighter"
import { logger } from "../utils/logger"
import { formatCommand, runCommand } from "../utils/run-command"

const defaultRegistry = "https://pliantui.dev/r"
const reactPackage = "@pliantui/react"
const baseItems = ["pliant-region"]

const initOptionsSchema = z.object({
  cwd: z.string(),
  yes: z.boolean(),
  registry: z.string().transform((value, ctx) => {
    const registry = parseRegistryUrl(value)
    if (!registry) {
      ctx.addIssue({
        code: "custom",
        message:
          "The registry must be an http or https URL without a query string, fragment or credentials.",
      })
      return z.NEVER
    }
    return registry
  }),
})

class InitCancelledError extends Error {}

type Step =
  | { label: string; kind: "registry"; template: string }
  | {
      label: string
      kind: "command"
      command: string
      args: string[]
      needsRegistry: boolean
    }

export const init = new Command()
  .name("init")
  .description("add Pliant to your Next.js and shadcn project")
  .option("-y, --yes", "skip confirmation prompts.", false)
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .option(
    "-r, --registry <url>",
    "the registry to install components from.",
    defaultRegistry
  )
  .action(async (opts: Record<string, unknown>) => {
    try {
      const options = initOptionsSchema.parse({
        ...opts,
        cwd: path.resolve(String(opts["cwd"])),
      })
      await setUp(options, init.getOptionValueSource("registry") === "cli")
    } catch (error) {
      if (error instanceof InitCancelledError) {
        logger.break()
        logger.info("Cancelled. Nothing more was installed.")
        process.exit(0)
      }
      handleError(error)
    }
  })

async function setUp(
  options: z.infer<typeof initOptionsSchema>,
  registryGiven: boolean
) {
  const { cwd } = options
  if (!existsSync(cwd)) {
    throw new Error(`The path ${highlighter.info(cwd)} does not exist.`)
  }

  const project = await detectProject(cwd)
  if (!project.supported) {
    logger.break()
    logger.error(
      `${project.description} is not supported by ${highlighter.info("pliantui init")}.`
    )
    logger.error(
      `${highlighter.info("pliantui init")} sets up Next.js App Router projects that use shadcn/ui.`
    )
    logger.break()
    process.exit(1)
  }

  const config = await getConfig(cwd)
  if (!config) {
    logger.break()
    logger.error(`No ${highlighter.info("components.json")} found in ${cwd}.`)
    logger.error(
      `Run ${highlighter.info("npx shadcn@latest init")} to set up shadcn/ui, then run ${highlighter.info("pliantui init")} again.`
    )
    logger.break()
    process.exit(1)
  }
  const { components } = config.resolvedPaths
  if (!components) {
    throw new Error(
      `Could not resolve the ${highlighter.info("components")} alias in ${highlighter.info("components.json")}. Configure path aliases in tsconfig.json and try again.`
    )
  }

  const packageManager = await detectPackageManager(cwd)
  const missingPackage = !(reactPackage in project.dependencies)
  const missingItems = baseItems.filter(
    (item) =>
      !["tsx", "jsx"].some((extension) =>
        existsSync(path.join(components, "pliant", `${item}.${extension}`))
      )
  )

  // An @pliant entry already in components.json is the user's choice, so it's
  // only replaced when --registry asks for another URL.
  const template = registryTemplate(options.registry)
  const currentTemplate = await readPliantRegistry(cwd)
  const changeRegistry =
    currentTemplate === undefined ||
    (registryGiven && currentTemplate !== template)

  if (!missingPackage && missingItems.length === 0 && !changeRegistry) {
    logger.success("✔ Pliant is already set up in this project.")
    logger.break()
    logger.log(`Docs: ${highlighter.info(docsUrl)}`)
    return
  }

  if (!options.yes && !process.stdin.isTTY) {
    throw new Error(
      `${highlighter.info("pliantui init")} needs an interactive terminal to ask before it installs anything. Run it in one, or pass ${highlighter.info("--yes")}.`
    )
  }

  const steps: Step[] = []
  if (missingPackage) {
    steps.push({
      label: `Add ${reactPackage}`,
      kind: "command",
      ...installCommand(packageManager, reactPackage),
      needsRegistry: false,
    })
  }
  if (changeRegistry) {
    steps.push({
      label: `Add the ${namespace} registry to components.json`,
      kind: "registry",
      template,
    })
  }
  if (missingItems.length > 0) {
    steps.push({
      label: `Add ${missingItems.join(", ")}`,
      kind: "command",
      ...runnerCommand(packageManager, [
        "shadcn@latest",
        "add",
        ...missingItems.map((item) => `${namespace}/${item}`),
        ...(options.yes ? ["--yes"] : []),
      ]),
      needsRegistry: true,
    })
  }

  const registryEntry = `"${namespace}": "${template}"`
  let skipped = 0
  let registryMissing = currentTemplate === undefined
  for (const step of steps) {
    const printable =
      step.kind === "command"
        ? formatCommand(step.command, step.args)
        : registryEntry
    if (step.kind === "command" && step.needsRegistry && registryMissing) {
      skipped++
      logger.info(
        `Skipped, because shadcn needs the ${namespace} registry to find the components. Add ${registryEntry} to registries in components.json, then run: ${printable}`
      )
      continue
    }
    if (!options.yes) {
      const answers = await prompts(
        {
          type: "confirm",
          name: "run",
          message:
            step.kind === "command"
              ? `${step.label} with ${highlighter.info(printable)}?`
              : `${step.label} as ${highlighter.info(printable)}?`,
          initial: true,
        },
        {
          onCancel: () => {
            throw new InitCancelledError()
          },
        }
      )
      const run: unknown = answers.run
      if (run !== true) {
        skipped++
        logger.info(
          step.kind === "command"
            ? `Skipped. To do it yourself, run: ${printable}`
            : `Skipped. To do it yourself, add ${printable} to registries in components.json.`
        )
        continue
      }
    }
    try {
      if (step.kind === "command") {
        await runCommand(step.command, step.args, cwd)
      } else {
        await writePliantRegistry(cwd, step.template)
        registryMissing = false
      }
    } catch (error) {
      throw new Error(
        `${step.label} failed. Fix the problem and run ${highlighter.info("pliantui init")} again.\n${error instanceof Error ? error.message : String(error)}`
      )
    }
    logger.success(`✔ ${step.label}.`)
  }

  logger.break()
  if (skipped === 0) {
    logger.success("✔ Pliant is ready.")
  }
  logger.break()
  logger.log(
    "Next, wrap a page in PliantRoot and PliantPrePaint, and put its content in a PliantRegion:"
  )
  logger.break()
  logger.log(pageSnippet)
  logger.break()
  logger.log(`Docs: ${highlighter.info(docsUrl)}`)
}
