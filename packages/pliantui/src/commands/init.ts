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
  registry: z
    .string()
    .refine((value) => /^https?:\/\/\S+$/.test(value), {
      error: "The registry must be an http or https URL.",
    })
    .transform((value) => value.replace(/\/+$/, "")),
})

class InitCancelledError extends Error {}

interface Step {
  command: string
  args: string[]
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
      await setUp(options)
    } catch (error) {
      if (error instanceof InitCancelledError) {
        logger.break()
        logger.info("Cancelled. Nothing more was installed.")
        process.exit(0)
      }
      handleError(error)
    }
  })

async function setUp(options: z.infer<typeof initOptionsSchema>) {
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
      `To set up Pliant by hand, follow the installation guide: ${highlighter.info(docsUrl)}`
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

  const packageManager = detectPackageManager(cwd)
  const missingPackage = !(reactPackage in project.dependencies)
  const missingItems = baseItems.filter(
    (item) =>
      !["tsx", "jsx"].some((extension) =>
        existsSync(path.join(components, "pliant", `${item}.${extension}`))
      )
  )

  if (!missingPackage && missingItems.length === 0) {
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

  const steps: { label: string; step: Step }[] = []
  if (missingPackage) {
    steps.push({
      label: `Add ${reactPackage}`,
      step: installCommand(packageManager, reactPackage),
    })
  }
  if (missingItems.length > 0) {
    steps.push({
      label: `Add ${missingItems.join(", ")}`,
      step: runnerCommand(packageManager, [
        "shadcn@latest",
        "add",
        ...missingItems.map((item) => `${options.registry}/${item}.json`),
        ...(options.yes ? ["--yes"] : []),
      ]),
    })
  }

  let skipped = 0
  for (const { label, step } of steps) {
    const printable = formatCommand(step.command, step.args)
    if (!options.yes) {
      const answers = await prompts(
        {
          type: "confirm",
          name: "run",
          message: `${label} with ${highlighter.info(printable)}?`,
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
        logger.info(`Skipped. To do it yourself, run: ${printable}`)
        continue
      }
    }
    try {
      await runCommand(step.command, step.args, cwd)
    } catch (error) {
      throw new Error(
        `${label} failed. Fix the problem and run ${highlighter.info("pliantui init")} again.\n${error instanceof Error ? error.message : String(error)}`
      )
    }
    logger.success(`✔ ${label}.`)
  }

  logger.break()
  if (skipped === 0) {
    logger.success("✔ Pliant is ready.")
  }
  logger.break()
  logger.log("Next, wrap a page in PliantRoot with PliantPrePaint:")
  logger.break()
  logger.log(pageSnippet)
  logger.break()
  logger.log(`Docs: ${highlighter.info(docsUrl)}`)
}
