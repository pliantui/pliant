const identifier = /^[A-Za-z_$][\w$]*$/

// Prettier's default print width, so the output stays as Prettier would
// format it.
const printWidth = 80

/**
 * Renders JSON data as a JavaScript literal. `lead` is the text before the
 * value on its line, such as an object key, so a short array is kept on one
 * line only when the whole line fits.
 */
export function renderLiteral(value: unknown, indent = "", lead = ""): string {
  if (Array.isArray(value)) {
    const items = value.map((item) => renderLiteral(item, indent))
    const inline = `[${items.join(", ")}]`
    if (lead.length + inline.length + 1 <= printWidth) {
      return inline
    }
    const inner = `${indent}  `
    return `[\n${value.map((item: unknown) => `${inner}${renderLiteral(item, inner, inner)},`).join("\n")}\n${indent}]`
  }
  if (value !== null && typeof value === "object") {
    const inner = `${indent}  `
    const entries = Object.entries(value).map(([key, item]) => {
      const prefix = `${inner}${identifier.test(key) ? key : JSON.stringify(key)}: `
      return `${prefix}${renderLiteral(item, inner, prefix)},`
    })
    return entries.length === 0 ? "{}" : `{\n${entries.join("\n")}\n${indent}}`
  }
  return JSON.stringify(value)
}
