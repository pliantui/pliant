import path from "node:path"
import {
  Node,
  SyntaxKind,
  type CallExpression,
  type JsxElement,
  type JsxSelfClosingElement,
  type SourceFile,
} from "ts-morph"

import {
  itemIdSchema,
  nodeIdSchema,
  slotIdSchema,
  surfaceSchema,
  type Manifest,
} from "@pliantui/contract"

import { createDiagnostic, type Diagnostic } from "../utils/diagnostic"
import {
  describeExpression,
  getDeclarations,
  readObject,
  resolveExpression,
  unwrapExpression,
} from "../utils/read-static"
import { appDirectory, appRoutes, isAppLayout } from "./app-routes"
import { jsxElementsOf, tagOf } from "./jsx-elements"
import { isOpaqueTag } from "./opaque-tag"
import { isPliantExport } from "./pliant-export"
import { readColumns } from "./read-columns"
import {
  reaches,
  returnPath,
  usageOf,
  type MemberPath,
} from "./region-placement"
import { createRelevance } from "./relevance"
import {
  addNode,
  builtInKinds,
  type NodeKind,
  type ScannedSurface,
  type ScanReport,
} from "./scanned-surface"
import {
  componentName,
  componentOf,
  functionIn,
  isFunction,
  propOf,
  readObjectLiteral,
  readString,
  type ComponentFunction,
  type PropValue,
  type Route,
  type Scope,
} from "./scope"

type Parent = string | null | undefined

interface Walk {
  readonly surface: ScannedSurface
  readonly report: ScanReport
  readonly claimed: WeakMap<Scope, Set<Node>>
  readonly following: Set<Node>
  readonly visited: Set<Node>
  readonly kindOf: (fn: ComponentFunction) => NodeKind | undefined
  /**
   * Slots declared but not yet walked, by the variable holding the region,
   * so they take their place where the component renders the region.
   */
  readonly pendingSlots: Map<Node, PendingSlots[]>
  /** The project's folder, where its own code is. */
  readonly root: string
  /**
   * How many functions rendered once per row or item, like a `.map`
   * callback or a column's `cell`, the walk is inside.
   */
  readonly repeated: Repeat[]
}

/** A callback rendered once per row or item, like a `.map` callback. */
interface Repeat {
  /** The `.map` call or column function. */
  readonly at: Node
  /** The first element it renders, to name in reports. */
  first?: JsxElement | JsxSelfClosingElement
}

/** A region's slots, waiting for the place the component renders them. */
interface PendingSlots {
  /** Where the region sits in the variable's value, if the scan can tell. */
  readonly path: MemberPath | undefined
  /** The region's or table's id, for reports. */
  readonly name: string
  /** Records it, and walks its slots, where the component renders it. */
  readonly place: (parent: Parent) => void
}

type Hook = "region" | "table"

function hookOf(call: CallExpression): Hook | undefined {
  const callee = call.getExpression()
  if (!Node.isIdentifier(callee) && !Node.isPropertyAccessExpression(callee)) {
    return undefined
  }
  if (
    isPliantExport(callee, "@pliantui/react", "usePliantRegion") ||
    isPliantExport(callee, "@pliantui/react", "useRegionSlots")
  ) {
    return "region"
  }
  return isPliantExport(callee, "@pliantui/react/table", "usePliantTable")
    ? "table"
    : undefined
}

interface HookCall {
  readonly call: CallExpression
  readonly hook: Hook
  /** The function that calls the hook: a component, or the app's own hook. */
  readonly caller: ComponentFunction
  /** The call in the component that leads to the hook. */
  readonly site: CallExpression
  /** The calls of the app's own hooks on the way to it. */
  readonly through: readonly CallExpression[]
  /** Where the region or table sits in the value `site` returns. */
  readonly path: MemberPath | undefined
}

/**
 * The region and table hooks a component calls, directly or through the
 * app's own hooks, like a `useOrdersTable` that returns `usePliantTable`.
 */
function hookCalls(
  fn: ComponentFunction,
  seen = new Set<ComponentFunction>()
): HookCall[] {
  seen.add(fn)
  return fn
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getFirstAncestor(isFunction) === fn)
    .flatMap((call): HookCall[] => {
      const hook = hookOf(call)
      if (hook) {
        return [{ call, hook, caller: fn, site: call, path: [], through: [] }]
      }
      // The app's own hook, called as `useX()` or `hooks.useX()`.
      const callee = call.getExpression()
      const name = Node.isPropertyAccessExpression(callee)
        ? callee.getName()
        : Node.isIdentifier(callee)
          ? callee.getText()
          : ""
      const custom = /^use[A-Z]/.test(name) ? functionIn(callee) : undefined
      return custom && !seen.has(custom)
        ? hookCalls(custom, seen).map((found) => {
            const outer = returnPath(custom, found.site)
            return {
              ...found,
              site: call,
              path: outer && found.path && [...outer, ...found.path],
              through: [call, ...found.through],
            }
          })
        : []
    })
}

// A call of the app's own hook that returns a region or table.
function isAppRegionHook(call: CallExpression) {
  const fn = functionIn(call.getExpression())
  return (
    fn !== undefined &&
    /^use[A-Z]/.test(componentName(fn) ?? "") &&
    hookCalls(fn).length > 0
  )
}

function warn(walk: Walk, node: Node, message: string) {
  walk.report.warnings.push(createDiagnostic(node, message))
  walk.surface.incomplete = true
}

function isClaimed(walk: Walk, scope: Scope, node: Node) {
  return walk.claimed.get(scope)?.has(node) ?? false
}

function claim(walk: Walk, scope: Scope, node: Node) {
  const claimed = walk.claimed.get(scope) ?? new Set()
  claimed.add(node)
  walk.claimed.set(scope, claimed)
}

function checkId(
  walk: Walk,
  at: Node,
  id: string,
  label: string,
  slotOf?: string
) {
  const name = slotOf
    ? `The slot "${id}" in ${slotOf}`
    : `The ${label} id "${id}"`
  if (/^[0-9]/.test(id)) {
    walk.report.errors.push(
      createDiagnostic(
        at,
        slotOf
          ? `${name} starts with a digit. JavaScript moves integer-like keys such as "2024" before every other key of an object, so the slots would render out of order. Rename it to start with a letter.`
          : `${name} starts with a digit. Node ids must start with a letter.`
      )
    )
    return false
  }
  const schema = slotOf ? slotIdSchema : nodeIdSchema
  if (!schema.safeParse(id).success) {
    walk.report.errors.push(
      createDiagnostic(
        at,
        `${name} must be kebab-case and start with a letter, like "order-summary".`
      )
    )
    return false
  }
  return true
}

/** Walks a JSX child: an element, a fragment, or an expression. */
function walkChild(child: Node, scope: Scope, parent: Parent, walk: Walk) {
  if (Node.isJsxText(child)) {
    return
  }
  if (Node.isJsxExpression(child)) {
    const expression = child.getExpression()
    if (expression) {
      walkRendered(expression, scope, parent, walk)
    }
    return
  }
  walkRendered(child, scope, parent, walk)
}

/** Walks what a function returns: the expressions it renders. */
function walkReturns(
  fn: ComponentFunction,
  scope: Scope,
  parent: Parent,
  walk: Walk
) {
  walk.surface.entered.add(fn)
  const body = fn.getBody()
  if (!body) {
    return
  }
  if (!Node.isBlock(body)) {
    walkRendered(body, scope, parent, walk)
    return
  }
  for (const statement of body.getDescendantsOfKind(
    SyntaxKind.ReturnStatement
  )) {
    const expression = statement.getExpression()
    if (expression && statement.getFirstAncestor(isFunction) === fn) {
      walkRendered(expression, scope, parent, walk)
    }
  }
}

// Calls over data whose callbacks return what is rendered.
const listMethods = new Set(["map", "flatMap", "filter"])

/**
 * Walks an expression the component renders. Only rendering paths are
 * followed: JSX, conditionals and logical operators, arrays, `.map`,
 * `.flatMap` and `.filter` callbacks, local variables, render props and
 * the app's own functions called to render. JSX inside any other call,
 * such as an effect or an event handler, isn't rendered here.
 */
function walkRendered(
  expression: Node,
  scope: Scope,
  parent: Parent,
  walk: Walk
) {
  if (isClaimed(walk, scope, expression)) {
    return
  }
  if (Node.isJsxExpression(expression) || Node.isJsxText(expression)) {
    walkChild(expression, scope, parent, walk)
    return
  }
  const node = unwrapExpression(expression)
  if (isClaimed(walk, scope, node)) {
    return
  }
  if (Node.isJsxElement(node) || Node.isJsxSelfClosingElement(node)) {
    walkElement(node, scope, parent, walk)
    return
  }
  if (Node.isJsxFragment(node)) {
    for (const child of node.getJsxChildren()) {
      walkChild(child, scope, parent, walk)
    }
    return
  }
  if (Node.isConditionalExpression(node)) {
    walkRendered(node.getWhenTrue(), scope, parent, walk)
    walkRendered(node.getWhenFalse(), scope, parent, walk)
    return
  }
  if (Node.isBinaryExpression(node)) {
    const operator = node.getOperatorToken().getKind()
    if (
      operator === SyntaxKind.BarBarToken ||
      operator === SyntaxKind.QuestionQuestionToken
    ) {
      walkRendered(node.getLeft(), scope, parent, walk)
    }
    if (
      operator === SyntaxKind.AmpersandAmpersandToken ||
      operator === SyntaxKind.BarBarToken ||
      operator === SyntaxKind.QuestionQuestionToken
    ) {
      walkRendered(node.getRight(), scope, parent, walk)
    }
    return
  }
  if (Node.isArrayLiteralExpression(node)) {
    for (const element of node.getElements()) {
      walkRendered(
        Node.isSpreadElement(element) ? element.getExpression() : element,
        scope,
        parent,
        walk
      )
    }
    return
  }
  if (Node.isObjectLiteralExpression(node)) {
    // A prop such as `items={[{ content: <Panel /> }]}`.
    for (const property of node.getProperties()) {
      const value = Node.isPropertyAssignment(property)
        ? property.getInitializer()
        : Node.isShorthandPropertyAssignment(property)
          ? property
          : Node.isSpreadAssignment(property)
            ? property.getExpression()
            : undefined
      if (value) {
        walkRendered(value, scope, parent, walk)
      }
    }
    return
  }
  if (
    Node.isIdentifier(node) ||
    Node.isPropertyAccessExpression(node) ||
    Node.isElementAccessExpression(node) ||
    Node.isShorthandPropertyAssignment(node)
  ) {
    renderValue(node, parent, walk)
    if (!Node.isElementAccessExpression(node)) {
      follow(node, scope, parent, walk)
    }
    return
  }
  if (Node.isCallExpression(node)) {
    walkCall(node, scope, parent, walk)
  }
}

/**
 * Places the region or table a rendered value reads, unless it only reads
 * a list's `length`.
 */
function renderValue(node: Node, parent: Parent, walk: Walk) {
  if (Node.isPropertyAccessExpression(node) && node.getName() === "length") {
    return
  }
  let root: Node = node
  while (
    Node.isPropertyAccessExpression(root) ||
    Node.isElementAccessExpression(root)
  ) {
    root = unwrapExpression(root.getExpression())
  }
  if (Node.isIdentifier(root) || Node.isShorthandPropertyAssignment(root)) {
    renderPendingSlots(root, parent, walk)
  }
}

function walkCall(
  call: CallExpression,
  scope: Scope,
  parent: Parent,
  walk: Walk
) {
  const callee = unwrapExpression(call.getExpression())
  if (
    Node.isPropertyAccessExpression(callee) &&
    listMethods.has(callee.getName())
  ) {
    renderValue(callee.getExpression(), parent, walk)
    // An inline callback, or a named one like `rows.map(renderRow)`.
    const [callback] = call.getArguments()
    walk.repeated.push({ at: call })
    walkFunction(callback && follows(callback, walk), scope, parent, walk)
    walk.repeated.pop()
    return
  }
  // `useMemo(() => <Panel />, deps)` renders what its callback returns.
  if (
    (Node.isIdentifier(callee) || Node.isPropertyAccessExpression(callee)) &&
    isPliantExport(callee, "react", "useMemo")
  ) {
    const [factory] = call.getArguments()
    walkFunction(factory && follows(factory, walk), scope, parent, walk)
    return
  }
  // A portal moves where the DOM goes, not where its content sits.
  if (
    (Node.isIdentifier(callee) || Node.isPropertyAccessExpression(callee)) &&
    isPliantExport(callee, "react-dom", "createPortal")
  ) {
    const [content] = call.getArguments()
    if (content) {
      walkRendered(content, scope, parent, walk)
    }
    return
  }
  if (callRenderProp(call, scope, parent, walk)) {
    return
  }
  // The app's own function called to render, like `{renderRows()}`.
  const name = Node.isIdentifier(callee) ? callee.getText() : ""
  const fn = name && !/^use[A-Z]/.test(name) ? follows(callee, walk) : undefined
  walkFunction(fn, scope, parent, walk)
}

/**
 * The function a reference holds, recording the reference, and every node
 * on the way, as followed for the surface.
 */
function follows(value: Node, walk: Walk) {
  const trail = new Set<Node>()
  const fn = functionIn(value, trail)
  if (fn) {
    for (const node of trail) {
      walk.surface.consumed.add(node)
    }
  }
  return fn
}

function walkFunction(
  fn: ComponentFunction | undefined,
  scope: Scope,
  parent: Parent,
  walk: Walk
) {
  if (fn && !walk.following.has(fn)) {
    walk.following.add(fn)
    walkReturns(fn, scope, parent, walk)
    walk.following.delete(fn)
  }
}

/**
 * Walks what a render prop returns, like `render(item)`, when the prop is a
 * function written where the component is rendered. Returns whether the
 * call is a render prop.
 */
function callRenderProp(
  call: CallExpression,
  scope: Scope,
  parent: Parent,
  walk: Walk
) {
  const callee = call.getExpression()
  const prop = propOf(callee, scope)
  if (prop === undefined || prop === "*") {
    return false
  }
  const value = scope.props.get(prop)
  const [first] = value?.nodes ?? []
  if (!value || !first) {
    if (scope.unknownProps) {
      unfollowed(walk, call, prop)
    }
    return true
  }
  const resolved = resolveExpression(first)
  const declaration = getDeclarations(resolved)[0]
  const fn = isFunction(resolved)
    ? resolved
    : declaration && isFunction(declaration)
      ? declaration
      : undefined
  if (!fn) {
    unfollowed(walk, call, prop)
    return true
  }
  walk.surface.consumed.add(first)
  walk.surface.consumed.add(resolved)
  claim(walk, value.scope, first)
  walkReturns(fn, value.scope, parent, walk)
  return true
}

// Content props: `children`, and render props such as `renderItem`.
function isContentProp(prop: string) {
  return prop === "children" || /^render(?:[A-Z]|$)/.test(prop)
}

function unfollowed(walk: Walk, node: Node, prop: string) {
  if (isContentProp(prop) && !node.getFirstAncestor(Node.isJsxAttribute)) {
    warn(
      walk,
      node,
      `Content passed as ${prop} isn't followed, so the nodes in it are in no inventory.`
    )
  }
}

function walkRoutes(
  routes: readonly Route[],
  scope: Scope,
  parent: Parent,
  walk: Walk
) {
  for (const route of routes) {
    for (const node of route.trail) {
      walk.surface.consumed.add(node)
    }
    if (scope.rendering.has(route.fn)) {
      continue
    }
    const props = new Map<string, PropValue>()
    for (const [name, nested] of route.props) {
      props.set(name, { nodes: [], scope, routes: nested })
    }
    walkComponent(
      route.fn,
      {
        fn: route.fn,
        props,
        // Next.js passes route props such as `params`.
        unknownProps: true,
        rendering: new Set([...scope.rendering, route.fn]),
      },
      parent,
      walk
    )
  }
}

function renderPendingSlots(node: Node, parent: Parent, walk: Walk) {
  if (walk.pendingSlots.size === 0) {
    return
  }
  const usage = usageOf(node)
  const pending = usage && walk.pendingSlots.get(usage.variable)
  if (!usage || !pending) {
    return
  }
  const ready = pending.filter(
    ({ path }) => path !== undefined && reaches(usage.path, path)
  )
  walk.pendingSlots.set(
    usage.variable,
    pending.filter((item) => !ready.includes(item))
  )
  for (const { place } of ready) {
    place(parent)
  }
}

/** Walks the value a rendered prop or variable holds. */
function follow(node: Node, scope: Scope, parent: Parent, walk: Walk) {
  const prop = propOf(node, scope)
  if (prop !== undefined) {
    if (prop === "*") {
      return
    }
    const value = scope.props.get(prop)
    if (!value) {
      if (scope.unknownProps) {
        unfollowed(walk, node, prop)
      }
      return
    }
    walkRoutes(value.routes ?? [], value.scope, parent, walk)
    for (const item of value.nodes) {
      // A prop rendered in two places is walked in both.
      walk.claimed.get(value.scope)?.delete(item)
      walkRendered(item, value.scope, parent, walk)
      // Rendered here, so not again where the element is.
      claim(walk, value.scope, item)
    }
    return
  }
  const declaration = getDeclarations(node)[0]
  const initializer = Node.isVariableDeclaration(declaration)
    ? declaration.getInitializer()
    : undefined
  if (
    !initializer ||
    walk.following.has(initializer) ||
    initializer.getSourceFile().isInNodeModules()
  ) {
    return
  }
  walk.following.add(initializer)
  walk.surface.consumed.add(node)
  walk.surface.entered.add(initializer)
  walkRendered(initializer, scope, parent, walk)
  walk.following.delete(initializer)
}

function readJsxProps(
  element: JsxElement | JsxSelfClosingElement,
  scope: Scope
) {
  const opening = Node.isJsxElement(element)
    ? element.getOpeningElement()
    : element
  const props = new Map<string, PropValue>()
  let unknownProps = false
  for (const attribute of opening.getAttributes()) {
    if (Node.isJsxAttribute(attribute)) {
      const initializer = attribute.getInitializer()
      const value = Node.isJsxExpression(initializer)
        ? initializer.getExpression()
        : initializer
      if (value) {
        props.set(attribute.getNameNode().getText(), { nodes: [value], scope })
      }
      continue
    }
    const spread = attribute.getExpression()
    if (propOf(spread, scope) === "*") {
      for (const [name, value] of scope.props) {
        props.set(name, value)
      }
      unknownProps ||= scope.unknownProps
      continue
    }
    const object = readObjectLiteral(spread, scope)
    const read = "value" in object ? readObject(object.value) : undefined
    if (!read || !("value" in object)) {
      unknownProps = true
      continue
    }
    for (const [name, value] of read.entries) {
      props.set(name, { nodes: [value], scope: object.scope })
    }
    unknownProps ||= read.problems.length > 0
  }
  if (Node.isJsxElement(element)) {
    const children = element
      .getJsxChildren()
      .filter(
        (child) =>
          !Node.isJsxText(child) || !child.containsOnlyTriviaWhiteSpaces()
      )
    if (children.length > 0) {
      props.set("children", { nodes: children, scope })
    }
  }
  return { props, unknownProps }
}

function walkElement(
  element: JsxElement | JsxSelfClosingElement,
  scope: Scope,
  parent: Parent,
  walk: Walk
) {
  walk.visited.add(element)
  walk.surface.consumed.add(element)
  const repeat = walk.repeated.at(-1)
  if (repeat && !repeat.first) {
    repeat.first = element
  }
  const tag = (
    Node.isJsxElement(element) ? element.getOpeningElement() : element
  ).getTagNameNode()
  if (isPliantExport(tag, "@pliantui/react", "PliantRoot")) {
    return
  }
  const fn =
    Node.isIdentifier(tag) && /^[a-z]/.test(tag.getText())
      ? undefined
      : follows(tag, walk)
  if (!fn) {
    // Fail closed: a tag the scan can't follow, like a class component or
    // a component picked at runtime, may render anything.
    if (isOpaqueTag(tag, walk.root)) {
      warn(
        walk,
        element,
        `<${tag.getText()}> renders a component the scan can't follow, so ${walk.surface.surface} isn't read in full.`
      )
    }
    // An HTML element renders its children; its props don't render.
    if (Node.isJsxElement(element)) {
      for (const child of element.getJsxChildren()) {
        walkChild(child, scope, parent, walk)
      }
    }
    return
  }
  const { props, unknownProps } = readJsxProps(element, scope)
  if (!scope.rendering.has(fn)) {
    walkComponent(
      fn,
      {
        fn,
        props,
        unknownProps,
        rendering: new Set([...scope.rendering, fn]),
      },
      parent,
      walk,
      element
    )
  }
  // What the component didn't render itself, such as children it passes on
  // in a spread, belongs where the element is: props pass values on, and a
  // function prop is a render prop, except event handlers like `onPick`.
  for (const [name, value] of props) {
    if (value.scope !== scope || /^on[A-Z]/.test(name)) {
      continue
    }
    for (const node of value.nodes) {
      if (isClaimed(walk, scope, node)) {
        continue
      }
      const fn = isFunction(unwrapExpression(node))
        ? follows(node, walk)
        : undefined
      if (fn) {
        walkReturns(fn, scope, parent, walk)
      } else if (name === "children") {
        walkChild(node, scope, parent, walk)
      } else {
        walkRendered(node, scope, parent, walk)
      }
    }
  }
  // `<Grid {...table} />` passes the table on.
  const opening = Node.isJsxElement(element)
    ? element.getOpeningElement()
    : element
  for (const attribute of opening.getAttributes()) {
    if (Node.isJsxSpreadAttribute(attribute)) {
      renderValue(unwrapExpression(attribute.getExpression()), parent, walk)
    }
  }
}

function walkComponent(
  fn: ComponentFunction,
  scope: Scope,
  parent: Parent,
  walk: Walk,
  /** The element that renders the component, for reports. */
  element?: Node
) {
  walk.surface.files.add(fn.getSourceFile().getFilePath())
  walk.surface.entered.add(fn)
  // A lone region or table holds everything its component renders. With
  // several, which render no element of their own, the rest belongs where
  // the component sits, and each takes its place, parent and order, where
  // the component renders it.
  const calls = hookCalls(fn)
  // A region or table rendered once per row or item would repeat its id.
  const [repeat] = walk.repeated
  if (repeat && calls.length > 0) {
    for (const { call, site } of calls) {
      walk.visited.add(call)
      walk.surface.consumed.add(call)
      walk.surface.consumed.add(site.getExpression())
    }
    // Named by what the callback renders, and reported at the `.map` call
    // or column function that repeats it.
    const shown =
      repeat.first ??
      (Node.isJsxElement(element) || Node.isJsxSelfClosingElement(element)
        ? element
        : undefined)
    const what = shown
      ? `<${tagOf(shown).getText()}>`
      : (componentName(fn) ?? "A component")
    warn(
      walk,
      repeat.at,
      `${what} renders a region or table once per row or item here, so its id isn't unique and it's left out of ${walk.surface.surface}.`
    )
    walkReturns(fn, scope, parent, walk)
    return
  }
  const several = calls.length > 1
  let holder = parent
  const pending = new Set<Node>()
  for (const {
    call,
    hook,
    caller,
    site,
    path,
    through: hookThrough,
  } of calls) {
    walk.visited.add(call)
    walk.surface.consumed.add(call)
    for (const through of [site, ...hookThrough]) {
      walk.surface.consumed.add(through.getExpression())
    }
    walk.surface.files.add(caller.getSourceFile().getFilePath())
    // The app's own hook can't read the component's props, and its
    // arguments aren't followed.
    const callScope: Scope =
      caller === fn
        ? scope
        : {
            ...scope,
            fn: caller,
            props: new Map(),
            unknownProps: true,
            hook: true,
          }
    const declared =
      hook === "table"
        ? declareTable(call, callScope, walk)
        : declareRegion(call, callScope, walk)
    if (!several) {
      holder = declared.id
      declared.record(parent)
      if (hook === "table") {
        continue
      }
    }
    // The variable that holds it in the component, such as
    // `const region = useFramed()`.
    const key = site.getParentIfKind(SyntaxKind.VariableDeclaration) ?? site
    walk.pendingSlots.set(key, [
      ...(walk.pendingSlots.get(key) ?? []),
      {
        path,
        name: declared.id ?? `a ${hook}`,
        place: several
          ? (at) => {
              declared.record(at)
              declared.renderSlots()
            }
          : () => {
              declared.renderSlots()
            },
      },
    ])
    pending.add(key)
  }
  walkReturns(fn, scope, holder, walk)
  // What's still waiting belongs to the surface all the same, but where the
  // component renders it among its other nodes is unknown.
  for (const key of pending) {
    const left = walk.pendingSlots.get(key) ?? []
    walk.pendingSlots.delete(key)
    if (left.length > 0) {
      const names = left.map((item) => item.name).join(" and ")
      warn(
        walk,
        key,
        `Where ${componentName(fn) ?? "this component"} renders ${names} can't be told, so ${left.length === 1 ? "its" : "their"} place among its other nodes isn't known.`
      )
    }
    for (const { place } of left) {
      place(parent)
    }
  }
}

function contentKind(value: Node, walk: Walk): NodeKind {
  const node = unwrapExpression(value)
  const tag = Node.isJsxElement(node)
    ? node.getOpeningElement().getTagNameNode()
    : Node.isJsxSelfClosingElement(node)
      ? node.getTagNameNode()
      : undefined
  const fn = tag && componentOf(tag)
  return (fn && walk.kindOf(fn)) ?? { kind: builtInKinds.slot }
}

interface Declared {
  readonly id: string | undefined
  /** Records the node in `parent`. */
  readonly record: (parent: Parent) => void
  /** Records a region's slots and walks what they render. */
  readonly renderSlots: () => void
}

function declareRegion(
  call: CallExpression,
  scope: Scope,
  walk: Walk
): Declared {
  const [idArgument, slotsArgument] = call.getArguments()
  let id: string | undefined
  const read = idArgument && readString(idArgument, scope)
  if (!read || "problem" in read) {
    warn(
      walk,
      read && "node" in read ? read.node : call,
      `The id of a region can't be read${read ? `: ${read.problem}` : ""}.`
    )
  } else if (checkId(walk, idArgument, read.value, "region")) {
    id = read.value
  }
  const regionId = id
  const record = (parent: Parent) => {
    if (regionId !== undefined) {
      addNode(
        walk.surface,
        {
          id: regionId,
          // A region rendered as the slot of the same id is that slot.
          parent: parent === regionId ? undefined : parent,
          own: { kind: builtInKinds.region },
          content: undefined,
        },
        call,
        walk.report
      )
    }
  }

  const name = id ?? "a region"
  const slots = slotsArgument && readObjectLiteral(slotsArgument, scope)
  if (!slots || "problem" in slots) {
    warn(
      walk,
      slots && "node" in slots ? slots.node : call,
      `The slots of ${name} can't be read${slots ? `: ${slots.problem}` : ""}.`
    )
    return { id, record, renderSlots: () => undefined }
  }
  claim(walk, slots.scope, slots.value)
  walk.surface.entered.add(slots.value)
  const object = readObject(slots.value)
  for (const { node, reason } of object?.problems ?? []) {
    warn(walk, node, `A slot of ${name} can't be read: ${reason}.`)
  }
  const renderSlots = () => {
    renderSlotsOf(object?.entries ?? new Map(), id, name, slots.scope, walk)
  }
  return { id, record, renderSlots }
}

function renderSlotsOf(
  entries: ReadonlyMap<string, Node>,
  id: Parent,
  name: string,
  scope: Scope,
  walk: Walk
) {
  for (const [key, value] of entries) {
    if (!checkId(walk, value, key, "slot", name)) {
      continue
    }
    addNode(
      walk.surface,
      {
        id: key,
        parent: id,
        own: undefined,
        content: contentKind(value, walk),
      },
      value,
      walk.report
    )
    walkRendered(value, scope, key, walk)
  }
}

function declareTable(
  call: CallExpression,
  scope: Scope,
  walk: Walk
): Declared {
  const none: Declared = {
    id: undefined,
    record: () => undefined,
    renderSlots: () => undefined,
  }
  const [optionsArgument, settingsArgument] = call.getArguments()
  const settings =
    settingsArgument && readObjectLiteral(settingsArgument, scope)
  const idNode =
    settings && "value" in settings
      ? readObject(settings.value)?.entries.get("id")
      : undefined
  const read =
    idNode && settings && "value" in settings
      ? readString(idNode, settings.scope)
      : undefined
  if (!idNode || !read || "problem" in read) {
    warn(
      walk,
      read && "node" in read ? read.node : call,
      `The id of a table can't be read${read && "problem" in read ? `: ${read.problem}` : ""}.`
    )
    return none
  }
  if (!checkId(walk, idNode, read.value, "table")) {
    return none
  }
  const id = read.value

  const columnIds: { id: string; at: Node }[] = []
  const options = optionsArgument && readObjectLiteral(optionsArgument, scope)
  const columnsNode =
    options && "value" in options
      ? readObject(options.value)?.entries.get("columns")
      : undefined
  if (!columnsNode || !options || !("value" in options)) {
    warn(walk, call, `The columns of ${id} can't be read.`)
  } else {
    walk.surface.entered.add(columnsNode)
    walk.surface.entered.add(resolveExpression(columnsNode))
    walk.surface.consumed.add(columnsNode)
    // The table renders what its column defs' functions return, like a
    // `cell` or `header`, in place of the table.
    for (const defs of new Set([columnsNode, resolveExpression(columnsNode)])) {
      for (const fn of defs.getDescendants().filter(isFunction)) {
        const outer = fn.getParentOrThrow().getFirstAncestor(isFunction)
        if (!outer || !defs.containsRange(outer.getPos(), outer.getEnd())) {
          walk.repeated.push({ at: fn })
          walkFunction(fn, options.scope, id, walk)
          walk.repeated.pop()
        }
      }
    }
    const columns = readColumns(columnsNode, options.scope)
    for (const { node, reason } of columns.problems) {
      warn(walk, node, `A column of ${id} can't be read: ${reason}.`)
    }
    for (const column of columns.ids) {
      if (itemIdSchema.safeParse(column.id).success) {
        columnIds.push(column)
        continue
      }
      walk.report.warnings.push(
        createDiagnostic(
          column.at,
          `The column "${column.id}" of ${id} is left out: overlays can only address column ids that start with a letter and contain only letters, digits, - and _.`
        )
      )
    }
  }

  const record = (parent: Parent) => {
    addNode(
      walk.surface,
      {
        id,
        parent: parent === id ? undefined : parent,
        own: { kind: builtInKinds.table },
        content: undefined,
      },
      call,
      walk.report
    )
    for (const column of columnIds) {
      addNode(
        walk.surface,
        {
          id: `${id}/columns/${column.id}`,
          parent: undefined,
          own: { kind: builtInKinds.column },
          content: undefined,
        },
        column.at,
        walk.report
      )
    }
  }
  return { id, record, renderSlots: () => undefined }
}

function idArgumentOf(call: CallExpression, scope: Scope) {
  const [first, second] = call.getArguments()
  if (hookOf(call) === "region") {
    return first
  }
  const settings = second && readObjectLiteral(second, scope)
  return settings && "value" in settings
    ? readObject(settings.value)?.entries.get("id")
    : undefined
}

// A node reached along several paths is reported once.
function unique(diagnostics: readonly Diagnostic[]) {
  const seen = new Set<string>()
  return diagnostics.filter((diagnostic) => {
    const key = `${diagnostic.file}:${String(diagnostic.line)}:${diagnostic.message}`
    const isNew = !seen.has(key)
    seen.add(key)
    return isNew
  })
}

interface ScanOptions {
  readonly manifests: ReadonlyMap<string, Manifest>
  /** The ui folder the manifests were generated from. */
  readonly ui: string
  /** The project's root, where `app` or `src/app` is. */
  readonly root: string
}

/**
 * Finds every `PliantRoot` and walks what it renders, through the app's
 * own components, for the regions, slots, tables and columns on each
 * surface. Anything it can't read is reported, never guessed.
 */
export function scanSurfaces(
  sourceFiles: readonly SourceFile[],
  { manifests, ui, root }: ScanOptions
) {
  const surfaces = new Map<string, ScannedSurface>()
  const report: ScanReport = { errors: [], warnings: [] }
  const files = new Map(
    sourceFiles.map((sourceFile) => [sourceFile.getFilePath(), sourceFile])
  )
  const app = appDirectory(root, files)
  const visited = new Set<Node>()
  const kindOf = (fn: ComponentFunction): NodeKind | undefined => {
    const name = componentName(fn)
    const manifest = name === undefined ? undefined : manifests.get(name)
    const file = fn.getSourceFile().getFilePath()
    return manifest && !path.relative(ui, file).startsWith("..")
      ? { kind: manifest.kind, manifest }
      : undefined
  }

  for (const sourceFile of sourceFiles) {
    for (const element of jsxElementsOf(sourceFile)) {
      const tag = tagOf(element)
      if (!isPliantExport(tag, "@pliantui/react", "PliantRoot")) {
        continue
      }
      visited.add(element)
      const fn = element.getFirstAncestor(isFunction)
      const props = new Map<string, PropValue>()
      const scope: Scope = {
        fn,
        props,
        unknownProps: true,
        rendering: new Set(fn ? [fn] : []),
      }
      const fromLayout = isAppLayout(sourceFile.getFilePath(), app)
      const attribute = (
        Node.isJsxElement(element) ? element.getOpeningElement() : element
      ).getAttribute("surface")
      const initializer = Node.isJsxAttribute(attribute)
        ? attribute.getInitializer()
        : undefined
      const value = Node.isJsxExpression(initializer)
        ? initializer.getExpression()
        : initializer
      const read = value && readString(value, scope)
      if (!read || "problem" in read) {
        report.warnings.push(
          createDiagnostic(
            element,
            `The surface of a PliantRoot can't be read${read ? `: ${read.problem}` : ""}, so what it renders is in no inventory.`
          )
        )
        continue
      }
      if (!surfaceSchema.safeParse(read.value).success) {
        report.errors.push(
          createDiagnostic(
            element,
            `The surface "${read.value}" must be a route pattern, such as /orders/[id], or a kebab-case surface id.`
          )
        )
        continue
      }
      const surface = surfaces.get(read.value) ?? {
        surface: read.value,
        nodes: new Map(),
        incomplete: false,
        fromLayout: false,
        files: new Set(),
        entered: new Set(),
        consumed: new Set(),
      }
      surface.fromLayout ||= fromLayout
      surface.files.add(sourceFile.getFilePath())
      surfaces.set(read.value, surface)
      const walk: Walk = {
        surface,
        report,
        claimed: new WeakMap(),
        following: new Set(),
        visited,
        kindOf,
        pendingSlots: new Map(),
        root,
        repeated: [],
      }
      if (fromLayout) {
        const routes = appRoutes(sourceFile.getFilePath(), files)
        for (const [name, nested] of routes.props) {
          props.set(name, { nodes: [], scope, routes: nested })
        }
        for (const route of routes.unreadable) {
          warn(
            walk,
            route,
            "The default export of this route can't be read as a component, so its nodes are in no inventory."
          )
        }
      }
      surface.entered.add(element)
      surface.consumed.add(element)
      if (Node.isJsxElement(element)) {
        for (const child of element.getJsxChildren()) {
          walkChild(child, scope, null, walk)
        }
      }
    }
  }

  const declares = declaringFunctions()
  for (const surface of surfaces.values()) {
    reportUnfollowed(surface, declares, report, root)
  }
  reportUnreached(
    sourceFiles,
    visited,
    report,
    [...surfaces.values()],
    declares
  )
  return {
    surfaces: [...surfaces.values()],
    report: {
      errors: unique(report.errors),
      warnings: unique(report.warnings),
    },
  }
}

/**
 * Whether a function declares a region or table, itself, through the app's
 * own hooks, or through the components it renders, so a wrapper like a
 * Banner that renders a PliantRegion counts too.
 */
function declaringFunctions() {
  const declares = new Map<ComponentFunction, boolean>()
  const declaresNodes = (fn: ComponentFunction): boolean => {
    const cached = declares.get(fn)
    if (cached !== undefined) {
      return cached
    }
    // A component that renders itself is decided by its other output.
    declares.set(fn, false)
    const result =
      hookCalls(fn).length > 0 ||
      [
        ...fn.getDescendantsOfKind(SyntaxKind.JsxElement),
        ...fn.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
      ].some((element) => {
        const rendered = componentOf(tagOf(element))
        return rendered !== undefined && declaresNodes(rendered)
      })
    declares.set(fn, result)
    return result
  }
  return declaresNodes
}

// Whether a value holds a function that declares regions or tables: the
// function itself, or an object, array or conditional that holds one.
function holdsDeclaring(
  value: Node,
  declaresNodes: (fn: ComponentFunction) => boolean,
  seen = new Set<Node>()
): boolean {
  if (seen.has(value)) {
    return false
  }
  seen.add(value)
  const fn = functionIn(value)
  if (fn) {
    return declaresNodes(fn)
  }
  const node = unwrapExpression(value)
  if (Node.isElementAccessExpression(node)) {
    return holdsDeclaring(node.getExpression(), declaresNodes, seen)
  }
  if (Node.isConditionalExpression(node)) {
    return [node.getWhenTrue(), node.getWhenFalse()].some((branch) =>
      holdsDeclaring(branch, declaresNodes, seen)
    )
  }
  const resolved = resolveExpression(node)
  if (resolved !== node) {
    return holdsDeclaring(resolved, declaresNodes, seen)
  }
  if (Node.isArrayLiteralExpression(node)) {
    return node
      .getElements()
      .some((element) => holdsDeclaring(element, declaresNodes, seen))
  }
  if (Node.isObjectLiteralExpression(node)) {
    return node.getProperties().some((property) => {
      const item = Node.isPropertyAssignment(property)
        ? property.getInitializer()
        : Node.isShorthandPropertyAssignment(property)
          ? property
          : undefined
      return item !== undefined && holdsDeclaring(item, declaresNodes, seen)
    })
  }
  return false
}

// A reference worth checking: a whole identifier or property access in an
// expression, not a name it declares, a JSX tag, an export or a type.
function isReference(node: Node) {
  const parent = node.getParent()
  if (!parent) {
    return false
  }
  if (Node.isShorthandPropertyAssignment(node)) {
    return true
  }
  if (!Node.isIdentifier(node) && !Node.isPropertyAccessExpression(node)) {
    return false
  }
  if (
    Node.isPropertyAccessExpression(parent) &&
    (parent.getExpression() === node || parent.getNameNode() === node)
  ) {
    return false
  }
  if (
    (Node.isJsxOpeningElement(parent) ||
      Node.isJsxSelfClosingElement(parent) ||
      Node.isJsxClosingElement(parent)) &&
    parent.getTagNameNode() === node
  ) {
    return false
  }
  if (
    Node.isJsxAttribute(parent) ||
    Node.isJsxNamespacedName(parent) ||
    Node.isExportAssignment(parent) ||
    (Node.isBindingElement(parent) && parent.getInitializer() !== node) ||
    Node.isShorthandPropertyAssignment(parent) ||
    Node.isImportSpecifier(parent) ||
    Node.isExportSpecifier(parent)
  ) {
    return false
  }
  return !(
    (Node.hasName(parent) || Node.isNameable(parent)) &&
    parent.getNameNode() === node
  )
}

/**
 * Makes sure every region or table a surface may render is placed or
 * reported. In the code the walk read for the surface (each function it
 * walked, each value it followed, and the module-level code of their
 * files), any JSX element, hook call or reference that leads to a region
 * or table and that the walk didn't follow, such as
 * `createElement(Banner)`, `as={Banner}`, a registry of components or a
 * dynamic import, is reported, and the surface is marked as not read in
 * full.
 */
function reportUnfollowed(
  surface: ScannedSurface,
  declaresNodes: (fn: ComponentFunction) => boolean,
  report: ScanReport,
  root: string
) {
  const flag = (node: Node, what: string) => {
    surface.incomplete = true
    report.warnings.push(
      createDiagnostic(
        node,
        `${what} may render a region or table the scan doesn't follow there, so ${surface.surface} isn't read in full.`
      )
    )
  }
  const { relevantTag, relevantReference } = createRelevance({
    root,
    declaresNodes,
    isRegionHook: (call) => hookOf(call) !== undefined || isAppRegionHook(call),
    isReference,
  })
  const check = (node: Node) => {
    if (surface.consumed.has(node)) {
      return
    }
    // JSX the walk didn't render here, like inside a render prop or a
    // callback, is allowed only when nothing it reaches may render a region
    // or table, or something the scan can't follow.
    if (Node.isJsxElement(node) || Node.isJsxSelfClosingElement(node)) {
      const tag = tagOf(node)
      if (relevantTag(tag)) {
        flag(node, `<${tag.getText()}>`)
      }
      return
    }
    if (Node.isCallExpression(node)) {
      if (hookOf(node)) {
        flag(node, describeExpression(node))
      } else if (node.getExpression().getKind() === SyntaxKind.ImportKeyword) {
        const module = node
          .getType()
          .getTypeArguments()[0]
          ?.getSymbol()
          ?.getDeclarations()[0]
        const inPackage =
          Node.isSourceFile(module) &&
          (module.isInNodeModules() || module.isDeclarationFile())
        const exported = Node.isSourceFile(module)
          ? [...module.getExportedDeclarations().values()].flat()
          : undefined
        // Fail closed: an export that may render a region or table, or
        // that can't be read, like a class, marks the surface.
        const mayRender = (declaration: Node) => {
          if (Node.isClassDeclaration(declaration)) {
            return true
          }
          const value = Node.isVariableDeclaration(declaration)
            ? declaration.getInitializer()
            : Node.isExportAssignment(declaration)
              ? declaration.getExpression()
              : declaration
          if (!value) {
            return false
          }
          const fn = isFunction(value)
            ? value
            : Node.isVariableDeclaration(declaration)
              ? functionIn(declaration.getNameNode())
              : functionIn(value)
          if (fn) {
            return declaresNodes(fn)
          }
          return (
            holdsDeclaring(value, declaresNodes) ||
            value.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
              .length > 0 ||
            value.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0
          )
        }
        if (!inPackage && (!exported || exported.some(mayRender))) {
          flag(node, describeExpression(node))
        }
      }
      return
    }
    if (isReference(node) && relevantReference(node)) {
      flag(node, describeExpression(node))
    }
  }
  const seen = new Set<Node>()
  const visit = (start: Node, moduleLevel: boolean) => {
    const inspect = (node: Node) => {
      if (seen.has(node)) {
        return false
      }
      seen.add(node)
      if (Node.isTypeNode(node) || Node.isImportDeclaration(node)) {
        return false
      }
      if (moduleLevel && isFunction(node)) {
        return false
      }
      // Another surface's root holds its own content.
      if (
        node !== start &&
        (Node.isJsxElement(node) || Node.isJsxSelfClosingElement(node)) &&
        isPliantExport(tagOf(node), "@pliantui/react", "PliantRoot")
      ) {
        return false
      }
      check(node)
      return true
    }
    if (!inspect(start)) {
      return
    }
    start.forEachDescendant((node, traversal) => {
      if (!inspect(node)) {
        traversal.skip()
      }
    })
  }
  const files = new Set<SourceFile>()
  for (const node of surface.entered) {
    files.add(node.getSourceFile())
  }
  for (const node of surface.entered) {
    visit(node, false)
  }
  for (const file of files) {
    visit(file, true)
  }
}

/**
 * Regions and tables no `PliantRoot` reaches, as far as the scan can
 * follow, belong to no surface's inventory. A surface that renders their
 * file may still render them, so it isn't read in full; when no surface
 * does, any may, through code the scan can't follow.
 */
function reportUnreached(
  sourceFiles: readonly SourceFile[],
  visited: ReadonlySet<Node>,
  report: ScanReport,
  surfaces: readonly ScannedSurface[],
  declaresNodes: (fn: ComponentFunction) => boolean
) {
  const unreached = (node: Node, what: string) => {
    const file = node.getSourceFile().getFilePath()
    const rendering = surfaces.filter((surface) => surface.files.has(file))
    for (const surface of rendering.length > 0 ? rendering : surfaces) {
      surface.incomplete = true
    }
    report.warnings.push(
      createDiagnostic(
        node,
        `${what} isn't rendered under a PliantRoot the scan can follow, so it's in no inventory.`
      )
    )
  }
  const noProps: Scope = {
    fn: undefined,
    props: new Map(),
    unknownProps: true,
    rendering: new Set(),
  }

  for (const sourceFile of sourceFiles) {
    for (const element of jsxElementsOf(sourceFile)) {
      const fn = visited.has(element) ? undefined : componentOf(tagOf(element))
      if (fn && declaresNodes(fn)) {
        unreached(element, `<${tagOf(element).getText()}>`)
      }
    }
    for (const call of sourceFile.getDescendantsOfKind(
      SyntaxKind.CallExpression
    )) {
      if (visited.has(call) || !hookOf(call)) {
        continue
      }
      // A hook whose id comes from props is reported where it's rendered.
      const idNode = idArgumentOf(call, noProps)
      const fn = call.getFirstAncestor(isFunction)
      const fromProps =
        idNode !== undefined &&
        fn !== undefined &&
        propOf(idNode, { ...noProps, fn }) !== undefined
      if (!fromProps) {
        unreached(call, describeExpression(call))
      }
    }
  }
}
