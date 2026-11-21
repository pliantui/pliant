import {
  Node,
  SyntaxKind,
  type JsxElement,
  type JsxSelfClosingElement,
  type SourceFile,
} from "ts-morph"

export function jsxElementsOf(sourceFile: SourceFile) {
  return [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ]
}

export function tagOf(element: JsxElement | JsxSelfClosingElement) {
  return (
    Node.isJsxElement(element) ? element.getOpeningElement() : element
  ).getTagNameNode()
}
