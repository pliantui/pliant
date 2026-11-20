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

import { createDiagnostic } from "../utils/diagnostic"
import {
  describeExpression,
  getDeclarations,
  readObject,
  unwrapExpression,
} from "../utils/read-static"
import { isPliantExport } from "./pliant-export"
import { readColumns } from "./read-columns"
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
  isFunction,
  propOf,
  readObjectLiteral,
  readString,
  type ComponentFunction,
  type PropValue,
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
}

type Hook = "region" | "table"

function hookOf(call: CallExpression): Hook | undefined {
  const callee = call.getExpression()
  if (!Node.isIdentifier(callee)) {
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

function hookCalls(fn: ComponentFunction) {
  return fn
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getFirstAncestor(isFunction) === fn)
    .flatMap((call) => {
      const hook = hookOf(call)
      return hook ? [{ call, hook }] : []
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
  walkNode(node, scope, parent, walk)
}

/** Walks the value a rendered prop or variable holds. */
function follow(node: Node, scope: Scope, parent: Parent, walk: Walk) {
  const prop = propOf(node, scope)
  if (prop !== undefined) {
    const value = prop === "*" ? undefined : scope.props.get(prop)
    for (const item of value?.nodes ?? []) {
      claim(walk, value?.scope ?? scope, item)
      walkRendered(item, value?.scope ?? scope, parent, walk)
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
  // A region or table holds everything its component renders.
  let holder = parent
  for (const { call, hook } of hookCalls(fn)) {
    walk.visited.add(call)
    holder =
      hook === "region"
        ? declareRegion(call, scope, parent, walk)
        : declareTable(call, scope, parent, walk)
  }
  const body = fn.getBody()
  if (body) {
    walkNode(body, scope, holder, walk)
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

function declareRegion(
  call: CallExpression,
  scope: Scope,
  parent: Parent,
  walk: Walk
): Parent {
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
    addNode(
      walk.surface,
      {
        id,
        // A region rendered as the slot of the same id is that slot.
        parent: parent === id ? undefined : parent,
        own: { kind: builtInKinds.region },
        content: undefined,
      },
      call,
      walk.report
    )
  }

  const name = id ?? "a region"
  const slots = slotsArgument && readObjectLiteral(slotsArgument, scope)
  if (!slots || "problem" in slots) {
    warn(
      walk,
      slots && "node" in slots ? slots.node : call,
      `The slots of ${name} can't be read${slots ? `: ${slots.problem}` : ""}.`
    )
    return id
  }
  claim(walk, slots.scope, slots.value)
  const object = readObject(slots.value)
  for (const { node, reason } of object?.problems ?? []) {
    warn(walk, node, `A slot of ${name} can't be read: ${reason}.`)
  }
  for (const [key, value] of object?.entries ?? []) {
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
    walkRendered(value, slots.scope, key, walk)
  }
  return id
}

function declareTable(
  call: CallExpression,
  scope: Scope,
  parent: Parent,
  walk: Walk
): Parent {
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
    return undefined
  }
  if (!checkId(walk, idNode, read.value, "table")) {
    return undefined
  }
  const id = read.value
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

  const options = optionsArgument && readObjectLiteral(optionsArgument, scope)
  const columnsNode =
    options && "value" in options
      ? readObject(options.value)?.entries.get("columns")
      : undefined
  if (!columnsNode || !options || !("value" in options)) {
    warn(walk, call, `The columns of ${id} can't be read.`)
    return id
  }
  const columns = readColumns(columnsNode, options.scope)
  for (const { node, reason } of columns.problems) {
    warn(walk, node, `A column of ${id} can't be read: ${reason}.`)
  }
  for (const column of columns.ids) {
    if (!itemIdSchema.safeParse(column.id).success) {
      walk.report.warnings.push(
        createDiagnostic(
          column.at,
          `The column "${column.id}" of ${id} is left out: overlays can only address column ids that start with a letter and contain only letters, digits, - and _.`
        )
      )
      continue
    }
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
  return id
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
}

/**
 * Finds every `PliantRoot` and walks what it renders, through the app's
 * own components, for the regions, slots, tables and columns on each
 * surface. Anything it can't read is reported, never guessed.
 */
export function scanSurfaces(
  sourceFiles: readonly SourceFile[],
  { manifests, ui }: ScanOptions
) {
  const surfaces = new Map<string, ScannedSurface>()
  const report: ScanReport = { errors: [], warnings: [] }
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
      const scope: Scope = {
        fn,
        props: new Map(),
        unknownProps: true,
        rendering: new Set(fn ? [fn] : []),
      }
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
      }
      surfaces.set(read.value, surface)
      const walk: Walk = {
        surface,
        report,
        claimed: new WeakMap(),
        following: new Set(),
        visited,
        kindOf,
      }
      if (Node.isJsxElement(element)) {
        for (const child of element.getJsxChildren()) {
          walkNode(child, scope, null, walk)
        }
      }
    }
  }

  reportUnreached(sourceFiles, visited, report)
  return { surfaces: [...surfaces.values()], report }
}

/**
 * Regions and tables no `PliantRoot` reaches, as far as the scan can
 * follow, belong to no surface's inventory.
 */
function reportUnreached(
  sourceFiles: readonly SourceFile[],
  visited: ReadonlySet<Node>,
  report: ScanReport
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
