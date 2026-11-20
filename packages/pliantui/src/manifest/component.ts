import path from "node:path"
import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type CallExpression,
  type FunctionDeclaration,
  type FunctionExpression,
  type ObjectBindingPattern,
  type ParameterDeclaration,
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

interface Binding {
  prop: string
  initializer?: Node | undefined
}

interface FoundProp {
  source: PropSource
  values: string[]
  boolean: boolean
  default?: string | undefined
  /** Contexts whose value wins over this prop when it's set. */
  contexts?: Node[] | undefined
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
  usesVariants: boolean
  /** Props and variants whose value the component works out itself. */
  computed: Set<string>
  /** Props that got different defaults from different definitions. */
  defaultConflicts: Map<string, Set<string>>
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
  diagnostics: Diagnostic[],
  cwd: string
) {
  const components = new Map<string, Component>()
  for (const sourceFile of sourceFiles) {
    for (const [
      exportName,
      declarations,
    ] of sourceFile.getExportedDeclarations()) {
      for (const declaration of declarations) {
        const fn = getComponentFunction(declaration)
        // A default export is named after its function, if it has a name.
        const name =
          exportName === "default"
            ? (fn?.getSymbol()?.getName() ?? exportName)
            : exportName
        if (!fn || !/^[A-Z]/.test(name)) {
          if (fn && exportName === "default") {
            diagnostics.push(
              createDiagnostic(
                declaration,
                "This default export has no component name, so it gets no manifest. Give its function a name or export it by name."
              )
            )
          }
          continue
        }
        const existing = components.get(name)
        if (existing) {
          if (existing.declaration !== declaration) {
            diagnostics.push(
              createDiagnostic(
                declaration,
                `Another component is also exported as ${name}, from ${path.relative(cwd, existing.declaration.getSourceFile().getFilePath())}. Only that one gets a manifest.`
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
          usesVariants: false,
          computed: new Set(),
          defaultConflicts: new Map(),
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

/** The props parameter, skipping a TypeScript `this` parameter. */
export function getPropsParameter(component: Component) {
  return component.fn
    .getParameters()
    .find((parameter) => parameter.getName() !== "this")
}

function readBindings(component: Component) {
  const parameter = getPropsParameter(component)
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
      if (
        prop !== undefined &&
        Node.isIdentifier(nameNode) &&
        !isReassigned(component, element)
      ) {
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

// A binding the component assigns to no longer holds what the user passed.
function isReassigned(component: Component, element: Node) {
  const isElement = (node: Node) =>
    (Node.isIdentifier(node) || Node.isShorthandPropertyAssignment(node)) &&
    getDeclarations(node, { followAliases: false })[0] === element
  // Destructuring assignments, like ({ tone } = other), assign to every
  // name inside the pattern.
  const refersToElement = (node: Node) => {
    const target = unwrapExpression(node)
    return isElement(target) || target.getDescendants().some(isElement)
  }
  return component.fn.getDescendants().some((node) => {
    if (Node.isBinaryExpression(node)) {
      const kind = node.getOperatorToken().getKind()
      return (
        kind >= SyntaxKind.FirstAssignment &&
        kind <= SyntaxKind.LastAssignment &&
        refersToElement(node.getLeft())
      )
    }
    if (
      Node.isPrefixUnaryExpression(node) ||
      Node.isPostfixUnaryExpression(node)
    ) {
      const operator = node.getOperatorToken()
      return (
        (operator === SyntaxKind.PlusPlusToken ||
          operator === SyntaxKind.MinusMinusToken) &&
        refersToElement(node.getOperand())
      )
    }
    return false
  })
}

/**
 * Whether a prop is still in a props object: not destructured out of it, or
 * out of any object it was spread from, and in its type when the props have
 * a declared type.
 */
export function isInPropsObject(node: Node, name: string): boolean {
  const expression = unwrapExpression(node)
  const declaration = Node.isIdentifier(expression)
    ? getDeclarations(expression, { followAliases: false })[0]
    : undefined
  if (Node.isParameterDeclaration(declaration)) {
    return isInDeclaredType(declaration, expression, name)
  }
  if (!Node.isBindingElement(declaration)) {
    return true
  }
  const pattern = declaration.getParent()
  if (!Node.isObjectBindingPattern(pattern)) {
    return true
  }
  const destructured = pattern
    .getElements()
    .some(
      (sibling) =>
        sibling !== declaration &&
        readPropertyKey(
          sibling.getPropertyNameNode() ?? sibling.getNameNode()
        ) === name
    )
  if (destructured) {
    return false
  }
  const holder = pattern.getParent()
  if (Node.isParameterDeclaration(holder)) {
    return isInDeclaredType(holder, expression, name)
  }
  const initializer = Node.isVariableDeclaration(holder)
    ? holder.getInitializer()
    : undefined
  return initializer ? isInPropsObject(initializer, name) : true
}

// Without a declared type, TypeScript infers a rest's type from the pattern
// alone, which holds none of the other props.
function isInDeclaredType(
  parameter: ParameterDeclaration,
  expression: Node,
  name: string
) {
  const typeNode = parameter.getTypeNode()
  if (!typeNode || typeNode.getKind() === SyntaxKind.AnyKeyword) {
    return true
  }
  const type = expression.getType()
  return (
    type.isAny() || type.isUnknown() || type.getProperty(name) !== undefined
  )
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
  if (
    existing.default !== undefined &&
    prop.default !== undefined &&
    existing.default !== prop.default
  ) {
    const conflict = component.defaultConflicts.get(name) ?? new Set()
    conflict.add(existing.default).add(prop.default)
    component.defaultConflicts.set(name, conflict)
  }
  const contexts = (prop.contexts ?? []).filter(
    (context) => !existing.contexts?.includes(context)
  )
  if (contexts.length > 0) {
    existing.contexts = [...(existing.contexts ?? []), ...contexts]
  }
  const added = prop.values.filter((value) => !existing.values.includes(value))
  existing.values.push(...added)
  return added.length > 0
}
