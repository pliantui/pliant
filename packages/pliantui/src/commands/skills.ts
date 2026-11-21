import { existsSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { Command } from "commander"
import prompts from "prompts"
import * as z from "zod"

import { readBundledSkills } from "../skills/bundled-skills"
import { planSkill } from "../skills/plan-skill"
import { skillsDirectory } from "../skills/skills-directory"
import { handleError } from "../utils/handle-error"
import { highlighter } from "../utils/highlighter"
import { logger } from "../utils/logger"

const addOptionsSchema = z.object({
  names: z.array(z.string()),
  cwd: z.string(),
  yes: z.boolean(),
  dir: z.string().optional(),
})

class AddCancelledError extends Error {}

const list = new Command()
  .name("list")
  .description("list the skills that come with pliantui")
  .action(async () => {
    try {
      const skills = await readBundledSkills()
      for (const skill of skills) {
        logger.log(highlighter.info(skill.name))
        logger.log(`  ${skill.description}`)
      }
    } catch (error) {
      handleError(error)
    }
  })

const add = new Command()
  .name("add")
  .description("add pliantui's skills for coding agents to your project")
  .argument("[names...]", "the skills to add. defaults to all of them.")
  .option("-y, --yes", "overwrite changed skill files without asking.", false)
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd()
  )
  .option(
    "-d, --dir <path>",
    "the folder to put skills in. defaults to .claude/skills if the project has a .claude folder, otherwise .agents/skills."
  )
  .action(async (names: string[], opts: Record<string, unknown>) => {
    try {
      const options = addOptionsSchema.parse({
        ...opts,
        names,
        cwd: path.resolve(String(opts["cwd"])),
      })
      await addSkills(options)
    } catch (error) {
      if (error instanceof AddCancelledError) {
        logger.break()
        logger.info("Cancelled. Nothing more was written.")
        process.exit(0)
      }
      handleError(error)
    }
  })

export const skills = new Command()
  .name("skills")
  .description("add pliantui's skills for coding agents to your project")
  .addCommand(add)
  .addCommand(list)

async function addSkills(options: z.infer<typeof addOptionsSchema>) {
  const { cwd } = options
  if (!existsSync(cwd)) {
    throw new Error(`The path ${highlighter.info(cwd)} does not exist.`)
  }

  const available = await readBundledSkills()
  const unknown = options.names.filter(
    (name) => !available.some((skill) => skill.name === name)
  )
  if (unknown.length > 0) {
    throw new Error(
      `There is no skill named ${unknown.map((name) => highlighter.info(name)).join(", ")}. Available skills: ${available.map((skill) => highlighter.info(skill.name)).join(", ")}.`
    )
  }
  const selected =
    options.names.length > 0
      ? available.filter((skill) => options.names.includes(skill.name))
      : available

  const root = skillsDirectory(cwd, options.dir)
  const relative = (target: string) => path.relative(cwd, target) || "."
  const plans = await Promise.all(
    selected.map(async (skill) => ({
      skill,
      destination: path.join(root, skill.name),
      files: await planSkill(skill, path.join(root, skill.name)),
    }))
  )

  const conflicts = plans.filter(({ files }) =>
    files.some((file) => file.status === "changed")
  )
  if (conflicts.length > 0 && !options.yes && !process.stdin.isTTY) {
    throw new Error(
      `${highlighter.info(relative(root))} already has different contents for ${conflicts.map(({ skill }) => highlighter.info(skill.name)).join(", ")}. ${highlighter.info("pliantui skills add")} needs an interactive terminal to ask before it overwrites them. Run it in one, or pass ${highlighter.info("--yes")}.`
    )
  }

  let written = 0
  for (const { skill, destination, files } of plans) {
    const pending = files.filter((file) => file.status !== "unchanged")
    if (pending.length === 0) {
      logger.info(
        `${skill.name} is already up to date in ${relative(destination)}.`
      )
      continue
    }
    const changed = pending.filter((file) => file.status === "changed")
    if (changed.length > 0 && !options.yes) {
      const answers = await prompts(
        {
          type: "confirm",
          name: "overwrite",
          message: `${highlighter.info(skill.name)} in ${highlighter.info(relative(destination))} differs from the one that comes with pliantui (${changed.map((file) => file.relativePath).join(", ")}). Overwrite it?`,
          initial: false,
        },
        {
          onCancel: () => {
            throw new AddCancelledError()
          },
        }
      )
      const overwrite: unknown = answers.overwrite
      if (overwrite !== true) {
        logger.info(`Skipped ${skill.name}. Its files were left as they are.`)
        continue
      }
    }
    for (const file of pending) {
      const target = path.join(destination, file.relativePath)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, file.content)
    }
    written++
    logger.success(
      `✔ ${changed.length > 0 ? "Updated" : "Added"} ${skill.name} in ${relative(destination)}.`
    )
  }

  if (written > 0) {
    logger.break()
    logger.log(
      `Coding agents that read ${highlighter.info(relative(root))} can now use ${selected.length === 1 ? "this skill" : "these skills"}.`
    )
  }
}
