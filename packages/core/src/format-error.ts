import type * as z from "zod"

export interface FormatErrorOptions {
  maxIssues?: number
  maxDepth?: number
  maxLength?: number
}

type Issue = z.core.$ZodIssue

const identifier = /^[A-Za-z_$][\w$]*$/

function formatPath(path: readonly PropertyKey[]) {
  return path
    .map((key, index) => {
      if (typeof key === "number") {
        return `[${String(key)}]`
      }
      if (typeof key === "string" && identifier.test(key)) {
        return index === 0 ? key : `.${key}`
      }
      return `[${JSON.stringify(String(key))}]`
    })
    .join("")
}

function nestedIssues(issue: Issue): readonly (readonly Issue[])[] {
  switch (issue.code) {
    case "invalid_union":
      return issue.errors
    case "invalid_key":
      return [issue.issues]
    default:
      return []
  }
}

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text
  }
  let end = maxLength - 1
  const last = text.charCodeAt(end - 1)
  if (last >= 0xd800 && last <= 0xdbff) {
    end--
  }
  return `${text.slice(0, end)}…`
}

function assertInteger(name: string, value: number, min: number) {
  if (!Number.isInteger(value) || value < min) {
    throw new RangeError(
      `${name} must be an integer of at least ${String(min)}`
    )
  }
}

export function formatError(
  error: z.ZodError,
  { maxIssues = 10, maxDepth = 2, maxLength = 2000 }: FormatErrorOptions = {}
) {
  assertInteger("maxIssues", maxIssues, 1)
  assertInteger("maxDepth", maxDepth, 0)
  assertInteger("maxLength", maxLength, 1)

  const shown = error.issues.slice(0, maxIssues)
  let budget = maxIssues - shown.length
  const lines: string[] = []
  const nested = new Set<string>()

  function line(issue: Issue, path: readonly PropertyKey[], depth: number) {
    const at = formatPath(path)
    return `${"  ".repeat(depth)}${at ? `${at}: ` : ""}${issue.message}`
  }

  function expand(issue: Issue, path: readonly PropertyKey[], depth: number) {
    if (depth >= maxDepth) {
      return
    }
    for (const branch of nestedIssues(issue)) {
      for (const child of branch) {
        if (budget === 0) {
          return
        }
        const childPath = [...path, ...child.path]
        const text = line(child, childPath, depth + 1)
        if (!nested.has(text)) {
          nested.add(text)
          budget--
          lines.push(text)
        }
        expand(child, childPath, depth + 1)
      }
    }
  }

  for (const issue of shown) {
    lines.push(line(issue, issue.path, 0))
    expand(issue, issue.path, 0)
  }
  const omitted = error.issues.length - shown.length
  if (omitted > 0) {
    lines.push(
      `and ${String(omitted)} more ${omitted === 1 ? "issue" : "issues"}`
    )
  }
  return truncate(lines.join("\n"), maxLength)
}
