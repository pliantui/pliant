const identifier = /^[A-Za-z_$][\w$]*$/

/** Renders JSON data as a JavaScript literal. */
export function renderLiteral(value: unknown, indent = ""): string {
  if (Array.isArray(value)) {
    const items = value.map((item) => renderLiteral(item, indent))
    const inline = `[${items.join(", ")}]`
    if (inline.length + indent.length <= 72) {
      return inline
    }
    const inner = `${indent}  `
    return `[\n${items.map((item) => `${inner}${item},`).join("\n")}\n${indent}]`
  }
  if (value !== null && typeof value === "object") {
    const inner = `${indent}  `
    const entries = Object.entries(value).map(
      ([key, item]) =>
        `${inner}${identifier.test(key) ? key : JSON.stringify(key)}: ${renderLiteral(item, inner)},`
    )
    return entries.length === 0 ? "{}" : `{\n${entries.join("\n")}\n${indent}}`
  }
  return JSON.stringify(value)
}
