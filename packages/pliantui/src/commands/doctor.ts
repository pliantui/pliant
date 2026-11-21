import { existsSync } from "node:fs"
import path from "node:path"
import { stripVTControlCharacters } from "node:util"
import { Command } from "commander"
import * as z from "zod"

import type { Check, CheckStatus } from "../doctor/check"
import { checkComponents } from "../doctor/check-components"
import { checkInventory } from "../doctor/check-inventory"
import { checkManifests } from "../doctor/check-manifests"
import { checkPrePaint } from "../doctor/check-pre-paint"
import { checkProject } from "../doctor/check-project"
import { scanProject } from "../scan/scan-project"
import { getConfig, type Config } from "../utils/get-config"
import { handleError } from "../utils/handle-error"
import { highlighter } from "../utils/highlighter"
import { logger } from "../utils/logger"
import { pluralize } from "../utils/pluralize"
import { spinner } from "../utils/spinner"

const doctorOptionsSchema = z.object({
  cwd: z.string(),
  json: z.boolean(),
})

export const doctor = new Command()
  .name("doctor")
  .description("check that Pliant is set up correctly in your project")
  .option("--json", "print the result as JSON.", false)
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .action(async (opts: Record<string, unknown>) => {
    let succeeded: boolean
    try {
      const options = doctorOptionsSchema.parse({
        ...opts,
        cwd: path.resolve(String(opts["cwd"])),
      })
      succeeded = await runChecks(options)
    } catch (error) {
      handleError(error)
    }
    if (!succeeded) {
      process.exit(1)
    }
  })

function errorMessage(error: unknown) {
  return stripVTControlCharacters(
    error instanceof Error ? error.message : String(error)
  )
}

async function readConfig(
  cwd: string
): Promise<{ check: Check; config?: Config }> {
  let config: Config | null
  try {
    config = await getConfig(cwd)
  } catch (error) {
    return {
      check: {
        name: "components-json",
        status: "fail",
        message: errorMessage(error),
        fix: "Fix components.json and tsconfig.json, then run npx pliantui doctor again.",
      },
    }
  }
  if (!config) {
    return {
      check: {
        name: "components-json",
        status: "fail",
        message: "No components.json found.",
        fix: "Run npx shadcn@latest init to create one.",
      },
    }
  }
  return {
    check: {
      name: "components-json",
      status: "pass",
      message: "components.json found.",
    },
    config,
  }
}

async function checksFor(cwd: string, json: boolean): Promise<Check[]> {
  const checks = await checkProject(cwd)
  const { check, config } = await readConfig(cwd)
  checks.push(check)
  if (!config) {
    const message = "Needs a valid components.json."
    return [
      ...checks,
      ...["components", "pre-paint", "inventory", "manifests"].map(
        (name): Check => ({ name, status: "skip", message })
      ),
    ]
  }
  checks.push(await checkComponents(cwd, config.resolvedPaths.components))

  const reading = json ? undefined : spinner("Scanning your app.").start()
  let scanned: Awaited<ReturnType<typeof scanProject>>
  try {
    scanned = await scanProject(cwd, config)
  } catch (error) {
    reading?.fail()
    const message = `Your app's source can't be read: ${errorMessage(error)}`
    return [
      ...checks,
      ...["pre-paint", "inventory"].map((name): Check => ({
        name,
        status: "fail",
        message,
      })),
      checkManifests(
        path.join(config.resolvedPaths.lib, "pliant"),
        config.tsx,
        cwd
      ),
    ]
  }
  reading?.stop()

  return [
    ...checks,
    checkPrePaint(scanned.sourceFiles, cwd),
    checkInventory(scanned, cwd),
    checkManifests(scanned.outputDirectory, config.tsx, cwd),
  ]
}

const symbols: Record<CheckStatus, string> = {
  pass: highlighter.success("✔"),
  warn: highlighter.warn("⚠"),
  fail: highlighter.error("✖"),
  skip: highlighter.muted("-"),
}

async function runChecks(
  options: z.infer<typeof doctorOptionsSchema>
): Promise<boolean> {
  const { cwd, json } = options
  if (!existsSync(cwd)) {
    throw new Error(`The path ${highlighter.info(cwd)} does not exist.`)
  }
  const checks = (await checksFor(cwd, json)).map((check) => ({
    ...check,
    ...(check.problems && {
      problems: check.problems.map((problem) => ({
        ...problem,
        file: path.relative(cwd, problem.file),
      })),
    }),
  }))
  const count = (status: CheckStatus) =>
    checks.filter((check) => check.status === status).length
  const failed = count("fail")

  if (json) {
    logger.log(JSON.stringify({ ok: failed === 0, checks }, null, 2))
    return failed === 0
  }

  for (const check of checks) {
    logger.log(`${symbols[check.status]} ${check.message}`)
    for (const problem of check.problems ?? []) {
      logger.log(
        highlighter.muted(
          `    ${problem.file}:${String(problem.line)} ${problem.message}`
        )
      )
    }
    if (check.fix && check.status !== "pass") {
      logger.log(`  ${check.fix}`)
    }
  }
  logger.break()
  const warned = count("warn")
  const summary = [
    pluralize(count("pass"), "check") + " passed",
    ...(warned > 0 ? [pluralize(warned, "warning")] : []),
    ...(failed > 0 ? [`${String(failed)} failed`] : []),
  ].join(", ")
  if (failed > 0) {
    logger.error(`${summary}.`)
    return false
  }
  logger.success(`${summary}.`)
  return true
}
