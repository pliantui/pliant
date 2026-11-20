import type { Node } from "ts-morph"

export interface Diagnostic {
  file: string
  line: number
  message: string
}

export function createDiagnostic(node: Node, message: string): Diagnostic {
  return {
    file: node.getSourceFile().getFilePath(),
    line: node.getStartLineNumber(),
    message,
  }
}
