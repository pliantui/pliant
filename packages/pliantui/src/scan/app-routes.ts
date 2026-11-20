import path from "node:path"
import { Node, type SourceFile } from "ts-morph"

import { componentOf, isFunction, type Route } from "./scope"

const routeFile = /^(page|layout)\.[cm]?[jt]sx?$/

function routeFileIn(
  files: ReadonlyMap<string, SourceFile>,
  directory: string,
  name: "page" | "layout"
) {
  for (const [file, sourceFile] of files) {
    const base = path.basename(file)
    if (
      path.dirname(file) === directory &&
      routeFile.test(base) &&
      base.startsWith(`${name}.`)
    ) {
      return sourceFile
    }
  }
  return undefined
}

function defaultComponent(sourceFile: SourceFile) {
  const declaration = sourceFile.getDefaultExportSymbol()?.getDeclarations()[0]
  if (declaration && isFunction(declaration)) {
    return declaration
  }
  return Node.isExportAssignment(declaration)
    ? componentOf(declaration.getExpression())
    : undefined
}

// Parallel routes (`@slot`) render as props other than `children`, private
// folders (`_name`) aren't routes, and intercepting routes (`(.)name`)
// replace another route's page.
function isChildSegment(name: string) {
  return (
    !name.startsWith("@") && !name.startsWith("_") && !name.startsWith("(.")
  )
}

/**
 * Whether a file is an App Router layout: `layout.tsx`, or another script
 * extension, inside an `app` folder.
 */
export function isAppLayout(file: string) {
  return (
    routeFile.test(path.basename(file)) &&
    path.basename(file).startsWith("layout.") &&
    path.dirname(file).split(path.sep).includes("app")
  )
}

/**
 * The routes a layout renders as its `children`: the page of its own
 * segment, and those of nested segments, each through the layouts between.
 * Route groups and dynamic segments are segments like any other.
 */
export function appRoutes(
  layout: string,
  files: ReadonlyMap<string, SourceFile>
): { routes: Route[]; unreadable: SourceFile[] } {
  const unreadable: SourceFile[] = []
  const route = (sourceFile: SourceFile, children: Route[]): Route[] => {
    const fn = defaultComponent(sourceFile)
    if (!fn) {
      unreadable.push(sourceFile)
      return []
    }
    return [{ fn, children }]
  }
  const routesIn = (directory: string): Route[] => {
    const page = routeFileIn(files, directory, "page")
    const routes = page ? route(page, []) : []
    const segments = new Set<string>()
    for (const file of files.keys()) {
      const relative = path.relative(directory, file).split(path.sep)
      const [segment] = relative
      if (relative.length > 1 && segment && segment !== "..") {
        segments.add(segment)
      }
    }
    for (const segment of [...segments].sort()) {
      if (!isChildSegment(segment)) {
        continue
      }
      const nested = path.join(directory, segment)
      const nestedLayout = routeFileIn(files, nested, "layout")
      routes.push(
        ...(nestedLayout
          ? route(nestedLayout, routesIn(nested))
          : routesIn(nested))
      )
    }
    return routes
  }
  return { routes: routesIn(path.dirname(layout)), unreadable }
}
