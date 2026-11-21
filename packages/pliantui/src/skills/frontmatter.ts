export interface Frontmatter {
  name: string
  description: string
}

const delimiter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

function unquote(value: string) {
  const quote = value[0]
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1)
  }
  return value
}

/**
 * Reads the `name` and `description` of a SKILL.md. Values are plain or
 * quoted scalars on one line, or continued on indented lines.
 */
export function parseFrontmatter(markdown: string): Frontmatter {
  const match = delimiter.exec(markdown)
  if (!match?.[1]) {
    throw new Error("The file has no frontmatter between --- lines.")
  }
  const values: Record<string, string> = {}
  let key: string | undefined
  for (const line of match[1].split(/\r?\n/)) {
    const entry = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line)
    if (entry?.[1] !== undefined && entry[2] !== undefined) {
      key = entry[1]
      values[key] = entry[2].trim()
    } else if (key !== undefined && /^\s+\S/.test(line)) {
      values[key] = `${values[key] ?? ""} ${line.trim()}`
    }
  }
  const { name, description } = values
  if (!name || !description) {
    throw new Error("The frontmatter needs a name and a description.")
  }
  return { name: unquote(name), description: unquote(description) }
}
