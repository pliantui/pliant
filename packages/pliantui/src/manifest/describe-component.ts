import { Node } from "ts-morph"

import type { Component } from "./component"
import { splitWords } from "./split-words"

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
  const words = splitWords(component.name).map((word, index) =>
    index > 0 && /^[A-Z][a-z]/.test(word) ? word.toLowerCase() : word
  )
  return words.join(" ")
}
