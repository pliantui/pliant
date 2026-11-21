import path from "node:path"
import { Node, type SourceFile } from "ts-morph"

import { functionIn, isFunction, type Route } from "./scope"

const routeFile = /^(page|default|layout)\.[cm]?[jt]sx?$/

function routeFilesIn(
  files: ReadonlyMap<string, SourceFile>,
  directory: string,
  names: readonly string[]
) {
  return [...files]
    .filter(([file]) => {
      const base = path.basename(file)
      return (
        path.dirname(file) === directory &&
        routeFile.test(base) &&
        names.some((name) => base.startsWith(`${name}.`))
      )
    })
    .map(([, sourceFile]) => sourceFile)
}

function defaultComponent(sourceFile: SourceFile, trail: Set<Node>) {
  const declaration = sourceFile.getDefaultExportSymbol()?.getDeclarations()[0]
  if (declaration && isFunction(declaration)) {
    return declaration
  }
  if (Node.isExportAssignment(declaration)) {
    return functionIn(declaration.getExpression(), trail)
  }
  // `export { Page as default }`
  return Node.isExportSpecifier(declaration)
    ? functionIn(declaration.getNameNode(), trail)
    : undefined
}

/**
 * The project's App Router folder: `app`, or `src/app` when there is no
 * `app`, as Next.js picks it.
 */
export function appDirectory(
  root: string,
  files: ReadonlyMap<string, SourceFile>
) {
  const app = path.join(root, "app")
  return [...files.keys()].some((file) => file.startsWith(`${app}${path.sep}`))
    ? app
    : path.join(root, "src", "app")
}

/**
 * Whether a file is an App Router layout: `layout.tsx`, or another script
 * extension, in the App Router folder `app`.
 */
export function isAppLayout(file: string, app: string) {
  const relative = path.relative(app, file)
  // On Windows, a file on another drive has an absolute relative path.
  return (
    /^layout\.[cm]?[jt]sx?$/.test(path.basename(file)) &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative)
  )
}

/**
 * The routes an App Router layout renders, by the prop it renders them as:
 * `children` for the page of its own segment and those of nested segments,
 * each through the layouts between, and one prop per parallel route, like
 * `modal` for an `@modal` folder. Route groups and dynamic segments are
 * segments like any other. Private folders (`_name`) aren't routes, and
 * intercepting routes (`(.)name`) replace another route's page.
 */
export function appRoutes(
  layout: string,
  files: ReadonlyMap<string, SourceFile>
): { props: Map<string, Route[]>; unreadable: SourceFile[] } {
  const unreadable: SourceFile[] = []
  const segmentsIn = (directory: string) => {
    const segments = new Set<string>()
    for (const file of files.keys()) {
      const [segment, ...rest] = path.relative(directory, file).split(path.sep)
      if (segment && segment !== ".." && rest.length > 0) {
        segments.add(segment)
      }
    }
    return [...segments].sort()
  }
  const route = (
    sourceFile: SourceFile,
    props: Map<string, Route[]>
  ): Route[] => {
    const trail = new Set<Node>()
    const fn = defaultComponent(sourceFile, trail)
    if (!fn) {
      unreadable.push(sourceFile)
      return []
    }
    return [{ fn, props, trail }]
  }
  const routesIn = (directory: string): Route[] => {
    const routes = routeFilesIn(files, directory, ["page", "default"]).flatMap(
      (page) => route(page, new Map())
    )
    for (const segment of segmentsIn(directory)) {
      if (!/^[@_]|^\(\./.test(segment)) {
        routes.push(...segmentRoutes(path.join(directory, segment)))
      }
    }
    return routes
  }
  // A folder with its own layout, a segment's or a parallel route's,
  // renders through it.
  const segmentRoutes = (directory: string): Route[] => {
    const [layout] = routeFilesIn(files, directory, ["layout"])
    return layout ? route(layout, propsOf(directory)) : routesIn(directory)
  }
  const propsOf = (directory: string) => {
    const props = new Map([["children", routesIn(directory)]])
    for (const segment of segmentsIn(directory)) {
      if (!segment.startsWith("@")) {
        continue
      }
      // `@children` is the same slot as the layout's own children.
      const name = segment.slice(1)
      props.set(name, [
        ...(props.get(name) ?? []),
        ...segmentRoutes(path.join(directory, segment)),
      ])
    }
    return props
  }
  return { props: propsOf(path.dirname(layout)), unreadable }
}
