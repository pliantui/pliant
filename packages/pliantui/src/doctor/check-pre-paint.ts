import path from "node:path"
import {
  Node,
  type JsxElement,
  type JsxSelfClosingElement,
  type SourceFile,
} from "ts-morph"

import { appDirectory } from "../scan/app-routes"
import { jsxElementsOf, tagOf } from "../scan/jsx-elements"
import { isPliantExport } from "../scan/pliant-export"
import { isFunction, readString } from "../scan/scope"
import { createDiagnostic, type Diagnostic } from "../utils/diagnostic"
import { pluralize } from "../utils/pluralize"
import { problemsOf, type Check } from "./check"

const routeFile = /^(page|layout|template|default)\.[cm]?[jt]sx?$/

// A segment's layout renders its template, which renders its page.
const rank: Record<string, number> = {
  layout: 0,
  template: 1,
  page: 2,
  default: 2,
}

function rankOf(file: string) {
  return rank[path.basename(file).split(".")[0] ?? ""] ?? 2
}

interface Rendered {
  element: JsxElement | JsxSelfClosingElement
  file: string
  /** `undefined` when the surface can't be read. */
  surface: string | undefined
}

function surfaceOf(element: JsxElement | JsxSelfClosingElement) {
  const attribute = (
    Node.isJsxElement(element) ? element.getOpeningElement() : element
  ).getAttribute("surface")
  const initializer = Node.isJsxAttribute(attribute)
    ? attribute.getInitializer()
    : undefined
  const value = Node.isJsxExpression(initializer)
    ? initializer.getExpression()
    : initializer
  if (!value) {
    return undefined
  }
  const read = readString(value, {
    fn: element.getFirstAncestor(isFunction),
    props: new Map(),
    unknownProps: true,
    rendering: new Set(),
  })
  return "value" in read ? read.value : undefined
}

function isUnder(file: string, directory: string) {
  const relative = path.relative(directory, file)
  return !relative.startsWith("..") && !path.isAbsolute(relative)
}

/**
 * Whether a route file renders inside `file`: it's in the same segment and
 * rendered by it, or in a segment below.
 */
function isBelow(other: string, file: string) {
  const directory = path.dirname(file)
  return path.dirname(other) === directory
    ? rankOf(other) > rankOf(file)
    : isUnder(other, directory)
}

/**
 * Whether a route file renders `file` inside it: it's a layout or template
 * of the same segment above it, or of a segment above.
 */
function isAbove(other: string, file: string) {
  if (other === file || rankOf(other) === 2) {
    return false
  }
  return path.dirname(other) === path.dirname(file)
    ? rankOf(other) < rankOf(file)
    : isUnder(file, path.dirname(other))
}

function isRouteFile(file: string, app: string) {
  return routeFile.test(path.basename(file)) && isUnder(file, app)
}

const fix =
  "Render <PliantPrePaint surface={surface} /> from @pliantui/react/pre-paint in each page or layout that renders a PliantRoot, with the same surface."

/**
 * Whether each `PliantRoot` has a `PliantPrePaint` with the same surface in
 * its route: in the page or layout that renders it, or in a layout above.
 * Where that can't be told statically, the check warns rather than passes.
 */
export function checkPrePaint(
  sourceFiles: readonly SourceFile[],
  root: string
): Check {
  const files = new Map(
    sourceFiles.map((sourceFile) => [sourceFile.getFilePath(), sourceFile])
  )
  const app = appDirectory(root, files)
  const roots: Rendered[] = []
  const prePaints: Rendered[] = []
  for (const [file, sourceFile] of files) {
    for (const element of jsxElementsOf(sourceFile)) {
      const tag = tagOf(element)
      const list = isPliantExport(tag, "@pliantui/react", "PliantRoot")
        ? roots
        : isPliantExport(tag, "@pliantui/react/pre-paint", "PliantPrePaint")
          ? prePaints
          : undefined
      list?.push({ element, file, surface: surfaceOf(element) })
    }
  }

  if (roots.length === 0) {
    return {
      name: "pre-paint",
      status: "skip",
      message: "No PliantRoot found.",
    }
  }

  const failures: Diagnostic[] = []
  const warnings: Diagnostic[] = []
  const relative = (file: string) => path.relative(root, file)
  for (const { element, file, surface } of roots) {
    if (surface === undefined) {
      warnings.push(
        createDiagnostic(
          element,
          "The surface of this PliantRoot can't be read, so its PliantPrePaint can't be matched."
        )
      )
      continue
    }
    const fits = (prePaint: Rendered) =>
      prePaint.surface === surface || prePaint.surface === undefined
    const describe = (prePaint: Rendered) =>
      prePaint.surface === undefined
        ? `a PliantPrePaint whose surface can't be read is in ${relative(prePaint.file)}`
        : `its PliantPrePaint is in ${relative(prePaint.file)}`
    const route = isRouteFile(file, app)
    const nearby = prePaints.filter(
      (prePaint) =>
        prePaint.file === file || (route && isAbove(prePaint.file, file))
    )
    if (nearby.some((prePaint) => prePaint.surface === surface)) {
      continue
    }
    const outside = prePaints.filter(
      (prePaint) => !isRouteFile(prePaint.file, app) && fits(prePaint)
    )
    const unreadable = nearby.find(fits)
    if (unreadable) {
      warnings.push(
        createDiagnostic(
          element,
          `PliantRoot renders ${surface}, and ${describe(unreadable)}, so they can't be matched.`
        )
      )
      continue
    }
    if (!route) {
      const [found = prePaints.find(fits)] = outside.filter(
        (prePaint) => prePaint.file !== file
      )
      if (found) {
        warnings.push(
          createDiagnostic(
            element,
            `This PliantRoot for ${surface} isn't in a page or layout, and ${describe(found)}, so whether each route that renders it also renders that PliantPrePaint can't be told.`
          )
        )
        continue
      }
      failures.push(
        createDiagnostic(element, `No PliantPrePaint renders ${surface}.`)
      )
      continue
    }
    const [below] = prePaints.filter(
      (prePaint) =>
        isRouteFile(prePaint.file, app) &&
        isBelow(prePaint.file, file) &&
        fits(prePaint)
    )
    if (below) {
      warnings.push(
        createDiagnostic(
          element,
          `PliantRoot renders ${surface} here, and ${describe(below)}, which renders inside this file, so whether every route under it renders one can't be told.`
        )
      )
      continue
    }
    const [component] = outside
    if (component) {
      warnings.push(
        createDiagnostic(
          element,
          `PliantRoot renders ${surface}, and ${describe(component)}, which isn't a page or layout, so whether this route renders it can't be told.`
        )
      )
      continue
    }
    const [mismatched] = nearby
    const [elsewhere] = prePaints.filter(fits)
    failures.push(
      createDiagnostic(
        element,
        mismatched
          ? `PliantRoot renders ${surface}, but the PliantPrePaint in ${relative(mismatched.file)} renders ${mismatched.surface ?? ""}.`
          : elsewhere
            ? `PliantRoot renders ${surface} with no PliantPrePaint in this route. The one in ${relative(elsewhere.file)} is in another route.`
            : `PliantRoot renders ${surface} with no PliantPrePaint in this route.`
      )
    )
  }

  if (failures.length > 0) {
    return {
      name: "pre-paint",
      status: "fail",
      message: `${pluralize(failures.length, "PliantRoot")} ${failures.length === 1 ? "has" : "have"} no PliantPrePaint with the same surface.`,
      fix,
      problems: [
        ...problemsOf("fail", failures),
        ...problemsOf("warn", warnings),
      ],
    }
  }
  if (warnings.length > 0) {
    return {
      name: "pre-paint",
      status: "warn",
      message: `${pluralize(warnings.length, "PliantRoot")} can't be matched with a PliantPrePaint.`,
      fix: "Render PliantRoot and PliantPrePaint in the route's page or layout, with the surface as a string or a const.",
      problems: problemsOf("warn", warnings),
    }
  }
  return {
    name: "pre-paint",
    status: "pass",
    message: `${pluralize(roots.length, "PliantRoot")} ${roots.length === 1 ? "has" : "have"} a PliantPrePaint with the same surface.`,
  }
}
