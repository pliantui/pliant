import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { beforeAll, describe, expect, it } from "vitest"

import { checkSkill } from "./skill-check"
import {
  createSkillContext,
  skillsDirectory,
  type SkillContext,
} from "./skill-context"

let context: SkillContext

beforeAll(async () => {
  context = await createSkillContext()
}, 120_000)

const validDescription =
  "Add Pliant to a Next.js app so its users can reshape pages. Use when asked to set up or try Pliant in a project."

function skill(body: string, description = validDescription) {
  return `---\nname: sample\ndescription: ${description}\n---\n\n${body}\n`
}

describe("the skills that come with pliantui", () => {
  it("ships at least one skill", async () => {
    expect(await readdir(skillsDirectory)).toContain("setup")
  })

  it("only mention exports, commands, options and pages that exist", async () => {
    const folders = await readdir(skillsDirectory)
    const problems: string[] = []
    for (const folder of folders) {
      const directory = path.join(skillsDirectory, folder)
      const text = await readFile(path.join(directory, "SKILL.md"), "utf8")
      problems.push(
        ...checkSkill(text, folder, context, directory).map(
          (problem) => `${folder}: ${problem}`
        )
      )
    }
    expect(problems).toEqual([])
  })
})

describe("the skill check", () => {
  it("accepts references that exist", () => {
    const text = skill(
      [
        "```tsx",
        'import { PliantRoot, usePliantStore } from "@pliantui/react"',
        'import { usePliantTable } from "@pliantui/react/table"',
        'import { PliantRegion } from "@/components/pliant/pliant-region"',
        "```",
        "",
        "```bash",
        "npx pliantui init --yes --cwd .",
        "npx pliantui skills add setup --dir .agents/skills",
        "```",
        "",
        "See [the CLI](https://pliantui.dev/docs/cli) and",
        "[addresses](https://pliantui.dev/docs/concepts/surfaces#addresses), and add",
        "`pliant-data-table` with `npx shadcn@latest add @pliant/pliant-data-table`.",
      ].join("\n")
    )

    expect(checkSkill(text, "sample", context)).toEqual([])
  })

  it("rejects an export that doesn't exist", () => {
    const text = skill(
      '```tsx\nimport { PliantRoot, PliantBogus } from "@pliantui/react"\n```'
    )

    expect(checkSkill(text, "sample", context)).toContain(
      "@pliantui/react does not export PliantBogus."
    )
  })

  it("rejects an export from the wrong entry point", () => {
    const text = skill(
      '```tsx\nimport { usePliantTable } from "@pliantui/react"\n```'
    )

    expect(checkSkill(text, "sample", context)).toContain(
      "@pliantui/react does not export usePliantTable."
    )
  })

  it("rejects a module that doesn't exist", () => {
    const text = skill(
      '```tsx\nimport { PliantRegion } from "@/components/pliant/pliant-bogus"\n```'
    )

    expect(checkSkill(text, "sample", context)).toContain(
      "@/components/pliant/pliant-bogus is not a module Pliant provides."
    )
  })

  it("rejects an identifier in the text that nothing exports", () => {
    const text = skill("Wrap the page in `PliantBogusRoot`.")

    expect(checkSkill(text, "sample", context)).toContain(
      "PliantBogusRoot is not exported by any Pliant package or component."
    )
  })

  it("rejects a command that doesn't exist", () => {
    const text = skill("```bash\nnpx pliantui frobnicate\n```")

    expect(checkSkill(text, "sample", context)).toContain(
      'pliantui has no command frobnicate, in "pliantui frobnicate".'
    )
  })

  it("rejects a subcommand that doesn't exist", () => {
    const text = skill("Run `pliantui skills remove setup`.")

    expect(checkSkill(text, "sample", context)).toContain(
      'pliantui skills has no command remove, in "pliantui skills remove setup".'
    )
  })

  it("rejects an option that doesn't exist", () => {
    const text = skill("```bash\nnpx pliantui init --bogus\n```")

    expect(checkSkill(text, "sample", context)).toContain(
      'pliantui init has no option --bogus, in "pliantui init --bogus".'
    )
  })

  it("rejects a docs page that doesn't exist", () => {
    const text = skill("[Docs](https://pliantui.dev/docs/bogus)")

    expect(checkSkill(text, "sample", context)).toContain(
      "https://pliantui.dev/docs/bogus is not a docs page."
    )
  })

  it("rejects a heading that doesn't exist", () => {
    const text = skill("[Docs](https://pliantui.dev/docs/cli#bogus)")

    expect(checkSkill(text, "sample", context)).toContain(
      "https://pliantui.dev/docs/cli#bogus points at a heading that doesn't exist."
    )
  })

  it("rejects a registry item that doesn't exist", () => {
    const text = skill(
      "Add https://pliantui.dev/r/pliant-bogus.json, a `pliant-bogus` component."
    )

    expect(checkSkill(text, "sample", context)).toEqual([
      "pliant-bogus is not a registry item.",
      "https://pliantui.dev/r/pliant-bogus.json is not a registry item.",
    ])
  })

  it("rejects an @pliant item that doesn't exist", () => {
    const text = skill(
      "```bash\nnpx shadcn@latest add @pliant/pliant-bogus --yes\n```"
    )

    expect(checkSkill(text, "sample", context)).toEqual([
      "@pliant/pliant-bogus is not a registry item.",
    ])
  })

  it("rejects a name that isn't the folder's", () => {
    expect(checkSkill(skill("Hi."), "other", context)).toContain(
      'The frontmatter name "sample" must match the folder name other.'
    )
  })

  it("rejects a missing or oversized description", () => {
    expect(checkSkill("---\nname: sample\n---\n", "sample", context)).toContain(
      "The frontmatter needs a one-line description."
    )
    expect(
      checkSkill(skill("Hi.", "x".repeat(1025)), "sample", context)
    ).toHaveLength(1)
    expect(
      checkSkill(skill("Hi.", "Too short."), "sample", context)
    ).toHaveLength(1)
  })

  it("rejects text without frontmatter", () => {
    expect(checkSkill("# Hi\n", "sample", context)).toContain(
      "The file has no frontmatter between --- lines."
    )
  })
})
