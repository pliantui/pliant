import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type CallExpression,
  type FunctionDeclaration,
  type FunctionExpression,
  type ObjectBindingPattern,
  type SourceFile,
} from "ts-morph"

import { createDiagnostic, type Diagnostic } from "./diagnostic"
import type { PropSource } from "./inferred-component"
import {
  getDeclarations,
  readLiteral,
  readPropertyKey,
  unwrapExpression,
} from "./read-static"

type ComponentFunction =
  FunctionDeclaration | ArrowFunction | FunctionExpression

export interface Binding {
  prop: string
  initializer?: Node | undefined
}

export interface FoundProp {
  source: PropSource
  values: string[]
  boolean: boolean
  default?: string | undefined
}

export interface Component {
  name: string
  declaration: Node
  fn: ComponentFunction
  bindings: Map<Node, Binding>
  propsObjects: Set<Node>
  props: Map<string, FoundProp>
  unreadable: Set<string>
  variantsReadable: boolean
  passes: { target: Component; targetProp: string; binding: Binding }[]
  spreads: {
    target: Component
    rest: Node
    overridden: Set<string>
    presets: Map<string, string>
  }[]
  provides: { context: Node; key: string; binding: Binding }[]
}

export const fallbackOperators = new Set([
  SyntaxKind.QuestionQuestionToken,
  SyntaxKind.BarBarToken,
])

export function findComponents(
  sourceFiles: SourceFile[],
  diagnostics: Diagnostic[]
) {
  const components = new Map<string, Component>()
  for (const sourceFile of sourceFiles) {
    for (const [
      exportName,
      declarations,
    ] of sourceFile.getExportedDeclarations()) {
      for (const declaration of declarations) {
        const fn = getComponentFunction(declaration)
        const name =
          exportName === "default" && Node.isFunctionDeclaration(declaration)
            ? (declaration.getName() ?? exportName)
            : exportName
        if (!fn || !/^[A-Z]/.test(name)) {
          continue
        }
        const existing = components.get(name)
        if (existing) {
          if (existing.declaration !== declaration) {
            diagnostics.push(
              createDiagnostic(
                declaration,
                `Another component is also exported as ${name}, from ${existing.declaration.getSourceFile().getFilePath()}. Only that one gets a manifest.`
              )
            )
          }
          continue
        }
        const component: Component = {
          name,
          declaration,
          fn,
          bindings: new Map(),
          propsObjects: new Set(),
          props: new Map(),
          unreadable: new Set(),
          variantsReadable: true,
          passes: [],
          spreads: [],
          provides: [],
        }
        readBindings(component)
        components.set(name, component)
      }
    }
  }
  return [...components.values()]
}

function getComponentFunction(node: Node): ComponentFunction | undefined {
  if (
    Node.isFunctionDeclaration(node) ||
    Node.isArrowFunction(node) ||
    Node.isFunctionExpression(node)
  ) {
    return node
  }
  if (Node.isVariableDeclaration(node)) {
    const initializer = node.getInitializer()
    return initializer
      ? getComponentFunction(unwrapExpression(initializer))
      : undefined
  }
  if (Node.isIdentifier(node)) {
    const declaration = getDeclarations(node)[0]
    return declaration && declaration !== node
      ? getComponentFunction(declaration)
      : undefined
  }
  if (Node.isCallExpression(node)) {
    const callee = node.getExpression()
    const name = Node.isPropertyAccessExpression(callee)
      ? callee.getName()
      : callee.getText()
    const argument = node.getArguments()[0]
    if ((name === "forwardRef" || name === "memo") && argument) {
      return getComponentFunction(unwrapExpression(argument))
    }
  }
  return undefined
}

function readBindings(component: Component) {
  const parameter = component.fn.getParameters()[0]
  if (!parameter) {
    return
  }
  const addPattern = (pattern: ObjectBindingPattern) => {
    for (const element of pattern.getElements()) {
      if (element.getDotDotDotToken()) {
        component.propsObjects.add(element)
        continue
      }
      const nameNode = element.getNameNode()
      const prop = readPropertyKey(element.getPropertyNameNode() ?? nameNode)
      if (prop !== undefined && Node.isIdentifier(nameNode)) {
        component.bindings.set(element, {
          prop,
          initializer: element.getInitializer(),
        })
      }
    }
  }

  const nameNode = parameter.getNameNode()
  if (Node.isObjectBindingPattern(nameNode)) {
    addPattern(nameNode)
  } else {
    component.propsObjects.add(parameter)
  }

  for (const declaration of component.fn.getDescendantsOfKind(
    SyntaxKind.VariableDeclaration
  )) {
    const pattern = declaration.getNameNode()
    const initializer = declaration.getInitializer()
    if (
      Node.isObjectBindingPattern(pattern) &&
      initializer &&
      isPropsObject(component, initializer)
    ) {
      addPattern(pattern)
    }
  }
}

export function isPropsObject(component: Component, node: Node) {
  const expression = unwrapExpression(node)
  if (!Node.isIdentifier(expression)) {
    return false
  }
  const declaration = getDeclarations(expression, { followAliases: false })[0]
  return declaration !== undefined && component.propsObjects.has(declaration)
}

/** The component prop an expression passes on unchanged, if any. */

export function getBinding(
  component: Component,
  node: Node
): Binding | undefined {
  const expression = Node.isShorthandPropertyAssignment(node)
    ? node
    : unwrapExpression(node)
  if (
    Node.isIdentifier(expression) ||
    Node.isShorthandPropertyAssignment(expression)
  ) {
    const declaration = getDeclarations(expression, { followAliases: false })[0]
    return declaration ? component.bindings.get(declaration) : undefined
  }
  if (
    Node.isPropertyAccessExpression(expression) &&
    isPropsObject(component, expression.getExpression())
  ) {
    return { prop: expression.getName() }
  }
  if (
    Node.isBinaryExpression(expression) &&
    fallbackOperators.has(expression.getOperatorToken().getKind())
  ) {
    const left = getBinding(component, expression.getLeft())
    if (left) {
      return {
        prop: left.prop,
        initializer: left.initializer ?? expression.getRight(),
      }
    }
    return getBinding(component, expression.getRight())
  }
  return undefined
}

export function isCallTo(call: CallExpression, names: string[]) {
  const callee = call.getExpression()
  const name = Node.isPropertyAccessExpression(callee)
    ? callee.getName()
    : callee.getText()
  return names.includes(name)
}

export function getDefault(
  binding: Binding,
  values: string[],
  fallback: string | undefined
) {
  if (binding.initializer) {
    const literal = readLiteral(binding.initializer)
    return literal !== undefined && values.includes(String(literal))
      ? String(literal)
      : undefined
  }
  return fallback !== undefined && values.includes(fallback)
    ? fallback
    : undefined
}

export function addProp(component: Component, name: string, prop: FoundProp) {
  const existing = component.props.get(name)
  if (!existing) {
    component.props.set(name, prop)
    return true
  }
  const added = prop.values.filter((value) => !existing.values.includes(value))
  existing.values.push(...added)
  return added.length > 0
}
