import { existsSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { Command } from "commander"
import * as z from "zod"

import { scanProject } from "../scan/scan-project"
import type { Diagnostic } from "../utils/diagnostic"
import { getConfig } from "../utils/get-config"
import { handleError } from "../utils/handle-error"
import { highlighter } from "../utils/highlighter"
import { logger } from "../utils/logger"
import { pluralize } from "../utils/pluralize"
import { spinner } from "../utils/spinner"

const scanOptionsSchema = z.object({
  cwd: z.string(),
  check: z.boolean(),
  json: z.boolean(),
})

export const scan = new Command()
  .name("scan")
  .description("list the node ids on each surface of your app")
  .option(
    "--check",
    "fail when the saved inventory is out of date, without writing it.",
    false
  )
  .option("--json", "print the result as JSON.", false)
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .action(async (opts: Record<string, unknown>) => {
    let succeeded: boolean
    try {
      const options = scanOptionsSchema.parse({
        ...opts,
        cwd: path.resolve(String(opts["cwd"])),
      })
      succeeded = await scanApp(options)
    } catch (error) {
      handleError(error)
    }
    if (!succeeded) {
      process.exit(1)
    }
  })

async function scanApp(
  options: z.infer<typeof scanOptionsSchema>
): Promise<boolean> {
  const { cwd, check, json } = options
  const relative = (file: string) => path.relative(cwd, file) || "."
  const format = (diagnostic: Diagnostic) => ({
    ...diagnostic,
    file: relative(diagnostic.file),
  })

  if (!existsSync(cwd)) {
    throw new Error(`The path ${highlighter.info(cwd)} does not exist.`)
  }
  const config = await getConfig(cwd)
  if (!config) {
    throw new Error(
      `No ${highlighter.info("components.json")} found in ${highlighter.info(cwd)}. Run ${highlighter.info("npx shadcn@latest init")} to create one, then try again.`
    )
  }
  const reading = json ? undefined : spinner("Scanning your app.").start()
  let scanned: Awaited<ReturnType<typeof scanProject>>
  try {
    scanned = await scanProject(cwd, config)
  } catch (error) {
    reading?.fail()
    throw error
  }
  reading?.succeed()

  const {
    surfaces,
    report,
    inventory,
    inventoryFile,
    outputDirectory,
    rendered,
    saved,
    upToDate,
  } = scanned
  const failed = report.errors.length > 0 || (check && !upToDate)
  const written = !check && report.errors.length === 0 && !upToDate

  if (written) {
    await mkdir(outputDirectory, { recursive: true })
    await writeFile(inventoryFile, rendered)
  }

  if (json) {
    logger.log(
      JSON.stringify(
        {
          file: relative(inventoryFile),
          ...(check ? { upToDate } : { written }),
          inventory,
          errors: report.errors.map(format),
          warnings: report.warnings.map(format),
        },
        null,
        2
      )
    )
    return !failed
  }

  for (const [surface, { baseIds }] of Object.entries(inventory)) {
    logger.log(
      `${highlighter.info(surface)}  ${pluralize(baseIds.ids.length, "id")}${baseIds.source === "mounted" ? highlighter.warn("  not read in full") : ""}`
    )
  }
  if (surfaces.length === 0) {
    logger.warn("No PliantRoot with a surface was found.")
  }
  const problems = [
    ...report.warnings.map((item) => highlighter.warn(describe(item))),
    ...report.errors.map((item) => highlighter.error(describe(item))),
  ]
  if (problems.length > 0) {
    logger.break()
    logger.log(problems.join("\n"))
  }
  logger.break()

  function describe(diagnostic: Diagnostic) {
    return `${relative(diagnostic.file)}:${String(diagnostic.line)} ${diagnostic.message}`
  }

  if (report.errors.length > 0) {
    logger.error(
      `Found ${pluralize(report.errors.length, "error")}. Fix ${report.errors.length === 1 ? "it" : "them"} and run ${highlighter.info("pliantui scan")} again.`
    )
    return false
  }
  if (check) {
    if (upToDate) {
      logger.success(`✔ ${relative(inventoryFile)} is up to date.`)
      return true
    }
    logger.error(
      `${relative(inventoryFile)} is ${saved === undefined ? "missing" : "out of date"}. Run ${highlighter.info("pliantui scan")} and commit the result.`
    )
    return false
  }
  logger.success(
    upToDate
      ? `✔ ${relative(inventoryFile)} is already up to date.`
      : `✔ Wrote ${relative(inventoryFile)}.`
  )
  return true
}
