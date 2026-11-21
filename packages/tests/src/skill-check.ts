import { existsSync } from "node:fs"
import path from "node:path"
import ts from "typescript"

import type { SkillContext } from "./skill-context"

const codeLanguages = new Set(["ts", "tsx", "typescript", "js", "jsx"])
const registryPrefix = "@/components/pliant/"

interface Fence {
  language: string
  code: string
}

function splitMarkdown(body: string) {
  const fences: Fence[] = []
  const prose = body.replace(
    /^```(\w*)[^\n]*\n([\s\S]*?)^```/gm,
    (_match, language: string, code: string) => {
      fences.push({ language, code })
      return ""
    }
  )
  const inline = [...prose.matchAll(/`([^`\n]+)`/g)].map(
    (match) => match[1] ?? ""
  )
  return { fences, prose, inline }
}

function frontmatterProblems(text: string, folder: string) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (!match?.[1]) {
    return ["The file has no frontmatter between --- lines."]
  }
  const field = (key: string) =>
    new RegExp(`^${key}:\\s*(.+)$`, "m").exec(match[1] ?? "")?.[1]?.trim()
  const problems: string[] = []
  const name = field("name")
  const description = field("description")
  if (name !== folder) {
    problems.push(
      `The frontmatter name ${JSON.stringify(name)} must match the folder name ${folder}.`
    )
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(folder) || folder.length > 64) {
    problems.push(
      `The name ${folder} must be lowercase words joined by hyphens, at most 64 characters.`
    )
  }
  if (!description) {
    problems.push("The frontmatter needs a one-line description.")
  } else if (description.length < 80 || description.length > 1024) {
    problems.push(
      `The description is ${String(description.length)} characters. Say what the skill does and when to use it in 80 to 1024.`
    )
  }
  return problems
}

function importProblems(fences: Fence[], context: SkillContext) {
  const problems: string[] = []
  for (const { language, code } of fences) {
    if (!codeLanguages.has(language)) {
      continue
    }
    const source = ts.createSourceFile(
      "block.tsx",
      code,
      ts.ScriptTarget.ES2023,
      false,
      ts.ScriptKind.TSX
    )
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        continue
      }
      const specifier = statement.moduleSpecifier.text
      const key = specifier.startsWith(registryPrefix)
        ? `registry:${specifier.slice(registryPrefix.length)}`
        : specifier
      const checked =
        specifier.startsWith("@pliantui/") ||
        specifier.startsWith(registryPrefix)
      if (!checked) {
        continue
      }
      const names = context.exportsOf(key)
      if (!names) {
        problems.push(`${specifier} is not a module Pliant provides.`)
        continue
      }
      const bindings = statement.importClause?.namedBindings
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          const imported = (element.propertyName ?? element.name).text
          if (!names.has(imported)) {
            problems.push(`${specifier} does not export ${imported}.`)
          }
        }
      }
    }
  }
  return problems
}

function identifierProblems(text: string, context: SkillContext) {
  const names = new Set(
    text.match(/\busePliant[A-Za-z0-9]+|\bPliant[A-Z][A-Za-z0-9]*/g)
  )
  return [...names]
    .filter((name) => !context.allExports.has(name))
    .map(
      (name) => `${name} is not exported by any Pliant package or component.`
    )
}

function commandLines(fences: Fence[], inline: string[]) {
  return [
    ...fences
      .filter(({ language }) => !codeLanguages.has(language))
      .flatMap(({ code }) => code.split("\n")),
    ...inline,
  ]
}

function commandProblems(lines: string[], context: SkillContext) {
  const problems: string[] = []
  for (const line of lines) {
    const match = /(?:^|[\s$])pliantui\s+(\S[^`\n]*)/.exec(line)
    if (!match?.[1]) {
      continue
    }
    const invoked: string[] = []
    for (const token of match[1].split(/\s+/)) {
      if (/^(#|\||&&|;|<|\[)/.test(token)) {
        break
      }
      const info = context.commandInfo(invoked)
      if (token.startsWith("-")) {
        const flag = token.split("=")[0] ?? token
        if (!info?.options.includes(flag)) {
          problems.push(
            `pliantui ${invoked.join(" ")}`.trim() +
              ` has no option ${flag}, in "pliantui ${match[1].trim()}".`
          )
        }
      } else if (info && info.commands.length > 0) {
        if (!info.commands.includes(token)) {
          problems.push(
            `${`pliantui ${invoked.join(" ")}`.trim()} has no command ${token}, in "pliantui ${match[1].trim()}".`
          )
          break
        }
        invoked.push(token)
      }
    }
  }
  return problems
}

function urlProblems(text: string, context: SkillContext) {
  const problems: string[] = []
  const urls = text.match(/https?:\/\/pliantui\.dev[^\s)"'`>\]]*/g) ?? []
  for (const found of urls) {
    const raw = found.replace(/[.,;:]+$/, "")
    const url = new URL(raw)
    const route = url.pathname.replace(/\/$/, "")
    if (route === "/docs" || route.startsWith("/docs/")) {
      const anchors = context.docs.get(route)
      if (!anchors) {
        problems.push(`${raw} is not a docs page.`)
      } else if (url.hash && !anchors.has(url.hash.slice(1))) {
        problems.push(`${raw} points at a heading that doesn't exist.`)
      }
    } else if (route.startsWith("/r/") && route.endsWith(".json")) {
      const item = route.slice("/r/".length, -".json".length)
      if (!context.registryItems.has(item)) {
        problems.push(`${raw} is not a registry item.`)
      }
    } else {
      problems.push(`${raw} is neither a docs page nor a registry item.`)
    }
  }
  return problems
}

function registryNameProblems(inline: string[], context: SkillContext) {
  return inline
    .filter((code) => /^pliant-[a-z-]+$/.test(code))
    .filter((code) => !context.registryItems.has(code))
    .map((code) => `${code} is not a registry item.`)
}

function linkProblems(prose: string, skillDirectory: string | undefined) {
  if (!skillDirectory) {
    return []
  }
  return [...prose.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((match) => match[1] ?? "")
    .filter((target) => !/^(https?:|mailto:|#)/.test(target))
    .filter(
      (target) =>
        !existsSync(path.join(skillDirectory, target.split("#")[0] ?? target))
    )
    .map(
      (target) => `The link to ${target} points at a file that doesn't exist.`
    )
}

export function checkSkill(
  text: string,
  folder: string,
  context: SkillContext,
  skillDirectory?: string
): string[] {
  const body = text.replace(/^---\n[\s\S]*?\n---\n/, "")
  const { fences, prose, inline } = splitMarkdown(body)
  return [
    ...frontmatterProblems(text, folder),
    ...importProblems(fences, context),
    ...identifierProblems(body, context),
    ...registryNameProblems(inline, context),
    ...commandProblems(commandLines(fences, inline), context),
    ...urlProblems(text, context),
    ...linkProblems(prose, skillDirectory),
  ]
}
