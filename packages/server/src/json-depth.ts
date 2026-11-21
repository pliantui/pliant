/**
 * Whether JSON text nests objects and arrays deeper than `maxDepth`. It
 * scans the text without recursion, so no input can overflow the stack.
 */
export function isTooDeep(text: string, maxDepth: number) {
  let depth = 0
  let inString = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (inString) {
      if (char === "\\") {
        index++
      } else if (char === '"') {
        inString = false
      }
    } else if (char === '"') {
      inString = true
    } else if (char === "[" || char === "{") {
      if (++depth > maxDepth) {
        return true
      }
    } else if (char === "]" || char === "}") {
      depth--
    }
  }
  return false
}
