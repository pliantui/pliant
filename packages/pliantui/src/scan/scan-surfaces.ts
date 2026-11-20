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
import { isPliantExport } from "./pliant-export"
import { readColumns } from "./read-columns"
import {
  reaches,
  returnPath,
  usageOf,
  type MemberPath,
} from "./region-placement"
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
        return [{ call, hook, caller: fn, site: call, path: [] }]
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
            }
          })
        : []
    })
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

/**
 * Walks what a node renders. Variables are walked where they are rendered,
 * not where they are declared, so a slots object kept in a `const` is walked
 * once, as slots.
 */
function walkNode(node: Node, scope: Scope, parent: Parent, walk: Walk) {
  if (isClaimed(walk, scope, node) || Node.isVariableDeclaration(node)) {
    return
  }
  if (Node.isIdentifier(node)) {
    renderPendingSlots(node, parent, walk)
    return
  }
  if (Node.isJsxElement(node) || Node.isJsxSelfClosingElement(node)) {
    walkElement(node, scope, parent, walk)
    return
  }
  if (Node.isJsxExpression(node) || Node.isReturnStatement(node)) {
    const expression = node.getExpression()
    if (expression) {
      walkRendered(expression, scope, parent, walk)
    }
    return
  }
  if (Node.isArrowFunction(node)) {
    const body = node.getBody()
    if (!Node.isBlock(body)) {
      walkRendered(body, scope, parent, walk)
      return
    }
  }
  node.forEachChild((child) => {
    walkNode(child, scope, parent, walk)
  })
}

function walkRendered(
  expression: Node,
  scope: Scope,
  parent: Parent,
  walk: Walk
) {
  const node = unwrapExpression(expression)
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
      return
    }
  }
  if (Node.isArrayLiteralExpression(node)) {
    for (const element of node.getElements()) {
      walkRendered(element, scope, parent, walk)
    }
    return
  }
  if (
    Node.isIdentifier(node) ||
    Node.isPropertyAccessExpression(node) ||
    Node.isShorthandPropertyAssignment(node)
  ) {
    follow(node, scope, parent, walk)
    return
  }
  if (
    Node.isCallExpression(node) &&
    callRenderProp(node, scope, parent, walk)
  ) {
    return
  }
  walkNode(node, scope, parent, walk)
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
  claim(walk, value.scope, first)
  const body = fn.getBody()
  if (body) {
    walkRendered(body, value.scope, parent, walk)
  }
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

/**
 * Whether a reference is where the component renders its value: in a JSX
 * child expression, or in a prop of a component element, and not inside a
 * callback such as an event handler or an effect.
 */
function isRendered(reference: Node) {
  for (
    let node: Node | undefined = reference.getParent();
    node;
    node = node.getParent()
  ) {
    if (isFunction(node)) {
      return false
    }
    if (Node.isJsxExpression(node)) {
      const owner = node.getParent()
      if (Node.isJsxAttribute(owner)) {
        const element = owner.getParent().getParent()
        return (
          (Node.isJsxOpeningElement(element) ||
            Node.isJsxSelfClosingElement(element)) &&
          componentOf(element.getTagNameNode()) !== undefined
        )
      }
      return true
    }
  }
  return false
}

function renderPendingSlots(node: Node, parent: Parent, walk: Walk) {
  if (walk.pendingSlots.size === 0 || !isRendered(node)) {
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
  renderPendingSlots(node, parent, walk)
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
      claim(walk, value.scope, item)
      walkRendered(item, value.scope, parent, walk)
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
  const tag = (
    Node.isJsxElement(element) ? element.getOpeningElement() : element
  ).getTagNameNode()
  if (isPliantExport(tag, "@pliantui/react", "PliantRoot")) {
    return
  }
  const fn = componentOf(tag)
  if (!fn) {
    element.forEachChild((child) => {
      walkNode(child, scope, parent, walk)
    })
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
      walk
    )
  }
  // What the component didn't render itself, such as children it passes on
  // in a spread, belongs where the element is.
  for (const value of props.values()) {
    if (value.scope !== scope) {
      continue
    }
    for (const node of value.nodes) {
      walkNode(node, scope, parent, walk)
    }
  }
}

function walkComponent(
  fn: ComponentFunction,
  scope: Scope,
  parent: Parent,
  walk: Walk
) {
  walk.surface.files.add(fn.getSourceFile().getFilePath())
  // A lone region or table holds everything its component renders. With
  // several, which render no element of their own, the rest belongs where
  // the component sits, and each takes its place, parent and order, where
  // the component renders it.
  const calls = hookCalls(fn)
  const several = calls.length > 1
  let holder = parent
  const pending = new Set<Node>()
  for (const { call, hook, caller, site, path } of calls) {
    walk.visited.add(call)
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
  const body = fn.getBody()
  if (body) {
    walkNode(body, scope, holder, walk)
  }
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

function jsxElementsOf(sourceFile: SourceFile) {
  return [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ]
}

function tagOf(element: JsxElement | JsxSelfClosingElement) {
  return (
    Node.isJsxElement(element) ? element.getOpeningElement() : element
  ).getTagNameNode()
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
      if (Node.isJsxElement(element)) {
        for (const child of element.getJsxChildren()) {
          walkNode(child, scope, null, walk)
        }
      }
    }
  }

  reportUnreached(sourceFiles, visited, report, [...surfaces.values()])
  return {
    surfaces: [...surfaces.values()],
    report: {
      errors: unique(report.errors),
      warnings: unique(report.warnings),
    },
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
  surfaces: readonly ScannedSurface[]
) {
  const declares = new Map<ComponentFunction, boolean>()
  const declaresNodes = (fn: ComponentFunction) => {
    const cached = declares.get(fn)
    if (cached !== undefined) {
      return cached
    }
    const result = hookCalls(fn).length > 0
    declares.set(fn, result)
    return result
  }
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
