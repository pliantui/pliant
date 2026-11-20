import {
  Node,
  type ArrowFunction,
  type FunctionDeclaration,
  type FunctionExpression,
  type ObjectLiteralExpression,
} from "ts-morph"

import {
  describeExpression,
  getDeclarations,
  resolveExpression,
  unwrapExpression,
} from "../utils/read-static"

export type ComponentFunction =
  FunctionDeclaration | ArrowFunction | FunctionExpression

/**
 * A route component an App Router layout renders: a page, or a nested
 * layout with the routes it renders in turn, by prop: `children`, and one
 * prop per parallel route.
 */
export interface Route {
  readonly fn: ComponentFunction
  readonly props: ReadonlyMap<string, readonly Route[]>
}

/** A prop as written where the component is rendered. */
export interface PropValue {
  readonly nodes: readonly Node[]
  readonly scope: Scope
  /** The routes a layout's `children` or parallel route prop stands for. */
  readonly routes?: readonly Route[] | undefined
}

/**
 * One render of a component: its function, and the props it was rendered
 * with. A root's scope has no caller, so none of its props are known.
 */
export interface Scope {
  readonly fn: ComponentFunction | undefined
  readonly props: ReadonlyMap<string, PropValue>
  /** Whether a spread the scan can't read may pass more props. */
  readonly unknownProps: boolean
  /** The components being rendered, so a recursive one stops. */
  readonly rendering: ReadonlySet<ComponentFunction>
}

export function isFunction(node: Node): node is ComponentFunction {
  return (
    Node.isFunctionDeclaration(node) ||
    Node.isArrowFunction(node) ||
    Node.isFunctionExpression(node)
  )
}

function propsParameter(scope: Scope) {
  return scope.fn?.getParameters()[0]
}

/**
 * The prop an expression reads in the component of `scope`: a destructured
 * prop (`{ id }`), or a property of the props object or of its rest
 * (`props.id`). `"*"` is the whole props object or rest.
 */
export function propOf(expression: Node, scope: Scope): string | undefined {
  const parameter = propsParameter(scope)
  if (!parameter) {
    return undefined
  }
  const node = unwrapExpression(expression)
  const isWholeProps = (declaration: Node | undefined) =>
    declaration === parameter ||
    (Node.isBindingElement(declaration) &&
      declaration.getDotDotDotToken() !== undefined &&
      declaration.getParent().getParent() === parameter)

  if (Node.isPropertyAccessExpression(node)) {
    const object = unwrapExpression(node.getExpression())
    return Node.isIdentifier(object) && isWholeProps(getDeclarations(object)[0])
      ? node.getName()
      : undefined
  }
  if (!Node.isIdentifier(node) && !Node.isShorthandPropertyAssignment(node)) {
    return undefined
  }
  const declaration = getDeclarations(node)[0]
  if (isWholeProps(declaration)) {
    return "*"
  }
  if (
    Node.isBindingElement(declaration) &&
    declaration.getParent().getParent() === parameter
  ) {
    return declaration.getPropertyNameNode()?.getText() ?? declaration.getName()
  }
  return undefined
}

type Read<T> =
  | { readonly value: T; readonly scope: Scope }
  | { readonly problem: string; readonly node: Node }

function readProp<T>(
  expression: Node,
  scope: Scope,
  read: (node: Node, scope: Scope) => Read<T>
): Read<T> | undefined {
  const prop = propOf(expression, scope)
  if (prop === undefined || prop === "*") {
    return undefined
  }
  const value = scope.props.get(prop)
  const [node] = value?.nodes ?? []
  if (!value || !node) {
    return {
      node: expression,
      problem: scope.unknownProps
        ? `the ${prop} prop, whose value can't be followed`
        : `the ${prop} prop, which isn't passed as a value`,
    }
  }
  return read(node, value.scope)
}

/** Reads a string, through props, `const`s and imports. */
export function readString(expression: Node, scope: Scope): Read<string> {
  const fromProp = readProp(expression, scope, readString)
  if (fromProp) {
    return fromProp
  }
  const value = resolveExpression(expression)
  if (
    Node.isStringLiteral(value) ||
    Node.isNoSubstitutionTemplateLiteral(value)
  ) {
    return { value: value.getLiteralValue(), scope }
  }
  return { problem: describeExpression(expression), node: expression }
}

/** Reads an object literal, through props, `const`s and imports. */
export function readObjectLiteral(
  expression: Node,
  scope: Scope
): Read<ObjectLiteralExpression> {
  const fromProp = readProp(expression, scope, readObjectLiteral)
  if (fromProp) {
    return fromProp
  }
  const value = resolveExpression(expression)
  if (Node.isObjectLiteralExpression(value)) {
    return { value, scope }
  }
  return { problem: describeExpression(expression), node: expression }
}

/**
 * The function a value holds: a function, one passed to a call such as
 * `memo`, `forwardRef` or `withAuth`, or one the app declares under a name
 * the value refers to.
 */
export function functionIn(value: Node): ComponentFunction | undefined {
  let current = unwrapExpression(value)
  while (Node.isCallExpression(current)) {
    const [first] = current.getArguments()
    if (!first) {
      return undefined
    }
    current = unwrapExpression(first)
  }
  if (isFunction(current)) {
    return current
  }
  if (
    !Node.isIdentifier(current) &&
    !Node.isPropertyAccessExpression(current)
  ) {
    return undefined
  }
  const declaration = getDeclarations(current)[0]
  const sourceFile = declaration?.getSourceFile()
  if (
    !declaration ||
    !sourceFile ||
    sourceFile.isInNodeModules() ||
    sourceFile.isDeclarationFile()
  ) {
    return undefined
  }
  if (Node.isFunctionDeclaration(declaration)) {
    return declaration
  }
  const initializer = Node.isVariableDeclaration(declaration)
    ? declaration.getInitializer()
    : undefined
  return initializer && !Node.isIdentifier(unwrapExpression(initializer))
    ? functionIn(initializer)
    : undefined
}

/** The function of the component a JSX tag renders, when the app declares it. */
export function componentOf(tag: Node): ComponentFunction | undefined {
  return Node.isIdentifier(tag) && /^[a-z]/.test(tag.getText())
    ? undefined
    : functionIn(tag)
}

/**
 * The name a component is declared with, the variable's for a function
 * passed to `memo` or `forwardRef`.
 */
export function componentName(fn: ComponentFunction): string | undefined {
  return Node.isFunctionDeclaration(fn)
    ? fn.getName()
    : fn.getFirstAncestor(Node.isVariableDeclaration)?.getName()
}
