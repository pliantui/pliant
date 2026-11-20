import path from "node:path"

import { highlighter } from "../utils/highlighter"
import type { ValueClass } from "./classify"
import type { Diagnostic } from "./diagnostic"
import type { DefaultType, InferredComponent } from "./inferred-component"

const classLabels: Record<ValueClass, string> = {
  user: "user",
  semantic: "semantic",
  state: "state",
  confirm: "needs confirmation",
  hidden: "hidden",
}

const classOrder: ValueClass[] = [
  "user",
  "semantic",
  "confirm",
  "state",
  "hidden",
]

function formatClass(value: ValueClass) {
  const label = classLabels[value].padEnd(20)
  return value === "confirm" ? highlighter.warn(label) : label
}

export function describeDefaultType(declaration: DefaultType) {
  switch (declaration.type) {
    case "boolean":
      return "true or false"
    case "date":
      return "a date"
    case "number":
      return "a number"
    case "string":
      return "a string"
    case "enum":
      return declaration.values.join(", ")
  }
}

export function formatSummary(
  components: InferredComponent[],
  diagnostics: Diagnostic[],
  cwd: string
) {
  const lines: string[] = []
  for (const component of components) {
    lines.push(
      `${highlighter.info(component.name)}  ${highlighter.muted(path.relative(cwd, component.file))}`
    )
    const off = [
      ...(component.label ? [] : ["renamed"]),
      ...(component.hideable ? [] : ["hidden"]),
    ]
    if (off.length > 0) {
      lines.push(`  ${highlighter.muted(`can't be ${off.join(" or ")}`)}`)
    }
    if (!component.variantsReadable) {
      lines.push(`  ${highlighter.warn("variants not readable")}`)
    }
    for (const prop of component.props) {
      const details = [
        `from ${prop.source}`,
        ...(prop.default === undefined ? [] : [`default "${prop.default}"`]),
      ]
      lines.push(`  ${prop.name}  ${highlighter.muted(details.join(", "))}`)
      for (const valueClass of classOrder) {
        const values = prop.values
          .filter((value) => value.class === valueClass)
          .map((value) => value.value)
        if (values.length > 0) {
          lines.push(`    ${formatClass(valueClass)} ${values.join(", ")}`)
        }
      }
      if (prop.overriddenBy.length > 0) {
        lines.push(
          highlighter.muted(
            `    a value set on ${prop.overriddenBy.join(" or ")} wins over this one.`
          )
        )
      }
      const physical = prop.values
        .map((value) => value.value)
        .filter((value) => value === "left" || value === "right")
      if (physical.length > 0) {
        lines.push(
          highlighter.muted(
            `    ${physical.join(" and ")} ${physical.length > 1 ? "are kept as written, so they don't" : "is kept as written, so it doesn't"} flip in right-to-left layouts.`
          )
        )
      }
    }
    for (const prop of component.unreadableProps) {
      lines.push(`  ${prop}  ${highlighter.warn("values not readable")}`)
    }
    for (const item of component.defaults) {
      lines.push(
        `  ${item.name}  ${highlighter.muted(`default state, ${describeDefaultType(item.declaration)}`)}`
      )
      lines.push(`    ${formatClass(item.class)}`.trimEnd())
    }
  }

  if (diagnostics.length > 0) {
    lines.push("")
    for (const diagnostic of diagnostics) {
      lines.push(
        highlighter.warn(
          `${path.relative(cwd, diagnostic.file)}:${String(diagnostic.line)} ${diagnostic.message}`
        )
      )
    }
  }
  return lines.join("\n")
}
