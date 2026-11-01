import type * as z from "zod"

export interface FormatIssuesOptions {
  maxIssues?: number
  maxDepth?: number
  maxLength?: number
}

function formatPath(path: readonly PropertyKey[]) {
  return path
    .map((key, index) =>
      typeof key === "number"
        ? `[${String(key)}]`
        : `${index === 0 ? "" : "."}${String(key)}`
    )
    .join("")
}

export function formatIssues(
  error: z.ZodError,
  { maxIssues = 10, maxDepth = 2, maxLength = 2000 }: FormatIssuesOptions = {}
) {
  const lines: string[] = []
  let total = 0

  function visit(
    issues: readonly z.core.$ZodIssue[],
    base: readonly PropertyKey[],
    depth: number
  ) {
    for (const issue of issues) {
      total++
      const path = [...base, ...issue.path]
      if (lines.length < maxIssues) {
        const at = formatPath(path)
        lines.push(
          `${"  ".repeat(depth)}${at ? `${at}: ` : ""}${issue.message}`
        )
      }
      if (issue.code === "invalid_union" && depth < maxDepth) {
        for (const branch of issue.errors) {
          visit(branch, path, depth + 1)
        }
      }
    }
  }

  visit(error.issues, [], 0)
  const omitted = total - lines.length
  const text = [
    ...lines,
    ...(omitted > 0 ? [`and ${String(omitted)} more`] : []),
  ].join("\n")
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}
