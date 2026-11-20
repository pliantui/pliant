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

function defaultComponent(sourceFile: SourceFile) {
  const declaration = sourceFile.getDefaultExportSymbol()?.getDeclarations()[0]
  if (declaration && isFunction(declaration)) {
    return declaration
  }
  return Node.isExportAssignment(declaration)
    ? functionIn(declaration.getExpression())
    : undefined
}

/**
 * Whether a file is an App Router layout: `layout.tsx`, or another script
 * extension, in the `app` or `src/app` folder of the project at `root`.
 */
export function isAppLayout(file: string, root: string) {
  const [first, second] = path.relative(root, file).split(path.sep)
  return (
    /^layout\.[cm]?[jt]sx?$/.test(path.basename(file)) &&
    (first === "app" || (first === "src" && second === "app"))
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
    const fn = defaultComponent(sourceFile)
    if (!fn) {
      unreadable.push(sourceFile)
      return []
    }
    return [{ fn, props }]
  }
  const routesIn = (directory: string): Route[] => {
    const routes = routeFilesIn(files, directory, ["page", "default"]).flatMap(
      (page) => route(page, new Map())
    )
    for (const segment of segmentsIn(directory)) {
      if (/^[@_]|^\(\./.test(segment)) {
        continue
      }
      const nested = path.join(directory, segment)
      const [nestedLayout] = routeFilesIn(files, nested, ["layout"])
      routes.push(
        ...(nestedLayout
          ? route(nestedLayout, propsOf(nested))
          : routesIn(nested))
      )
    }
    return routes
  }
  const propsOf = (directory: string) => {
    const props = new Map([["children", routesIn(directory)]])
    for (const segment of segmentsIn(directory)) {
      if (segment.startsWith("@")) {
        props.set(segment.slice(1), routesIn(path.join(directory, segment)))
      }
    }
    return props
  }
  return { props: propsOf(path.dirname(layout)), unreadable }
}
