import { Node } from "ts-morph"

import type { Component } from "./component"

function getJsDocDescription(node: Node): string | undefined {
  const holder = Node.isVariableDeclaration(node)
    ? node.getVariableStatement()
    : node
  if (!holder || !Node.isJSDocable(holder)) {
    return undefined
  }
  const description = holder
    .getJsDocs()
    .map((doc) => doc.getDescription().trim())
    .find(Boolean)
  return description?.split(/\n\s*\n/)[0]?.replace(/\s+/g, " ")
}

export function describeComponent(component: Component) {
  const description = getJsDocDescription(component.declaration)
  if (description) {
    const characters = Array.from(description)
    return characters.length > 200
      ? `${characters.slice(0, 197).join("")}...`
      : description
  }
  // Acronyms and numbered names keep their case: InputOTP is "Input OTP",
  // Toggle3D is "Toggle 3D".
  const words = component.name
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+|\s+/)
    .filter(Boolean)
    .map((word, index) =>
      index > 0 && /^[A-Z][a-z]/.test(word) ? word.toLowerCase() : word
    )
  return words.join(" ")
}
