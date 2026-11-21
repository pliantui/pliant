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
import type { Check } from "./check"

const routeFile = /^(page|layout|template|default)\.[cm]?[jt]sx?$/
const wrapperFile = /^(layout|template)\.[cm]?[jt]sx?$/

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

/**
 * The files whose output a route file renders in: the file itself, and the
 * layouts and templates of its segment and the segments above it.
 */
function routeChain(file: string, app: string, files: ReadonlySet<string>) {
  const chain = [file]
  for (
    let directory = path.dirname(file);
    !path.relative(app, directory).startsWith("..");
    directory = path.dirname(directory)
  ) {
    for (const candidate of files) {
      if (
        candidate !== file &&
        path.dirname(candidate) === directory &&
        wrapperFile.test(path.basename(candidate))
      ) {
        chain.push(candidate)
      }
    }
    if (directory === app) {
      break
    }
  }
  return chain
}

function isRouteFile(file: string, app: string) {
  const relative = path.relative(app, file)
  return (
    routeFile.test(path.basename(file)) &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative)
  )
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
  const fileNames = new Set(files.keys())
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
    const route = isRouteFile(file, app)
    const chain = new Set(route ? routeChain(file, app, fileNames) : [file])
    const nearby = prePaints.filter((prePaint) => chain.has(prePaint.file))
    if (nearby.some((prePaint) => prePaint.surface === surface)) {
      continue
    }
    const unreadable = (list: Rendered[]) =>
      list.some((prePaint) => prePaint.surface === undefined)
    if (route) {
      if (unreadable(nearby)) {
        warnings.push(
          createDiagnostic(
            element,
            `A PliantPrePaint in this route has a surface that can't be read, so it can't be matched with ${surface}.`
          )
        )
        continue
      }
      const others = [
        ...new Set(nearby.map((prePaint) => prePaint.surface ?? "")),
      ]
      failures.push(
        createDiagnostic(
          element,
          others.length > 0
            ? `PliantRoot renders ${surface}, but the PliantPrePaint in this route renders ${others.join(", ")}.`
            : `PliantRoot renders ${surface} with no PliantPrePaint in this route.`
        )
      )
      continue
    }
    if (
      unreadable(prePaints) ||
      prePaints.some((prePaint) => prePaint.surface === surface)
    ) {
      warnings.push(
        createDiagnostic(
          element,
          `This PliantRoot for ${surface} isn't in a page or layout, so whether each route that renders it also renders its PliantPrePaint can't be told.`
        )
      )
      continue
    }
    failures.push(
      createDiagnostic(element, `No PliantPrePaint renders ${surface}.`)
    )
  }

  if (failures.length > 0) {
    return {
      name: "pre-paint",
      status: "fail",
      message: `${pluralize(failures.length, "PliantRoot")} ${failures.length === 1 ? "has" : "have"} no PliantPrePaint with the same surface.`,
      fix,
      problems: [...failures, ...warnings],
    }
  }
  if (warnings.length > 0) {
    return {
      name: "pre-paint",
      status: "warn",
      message: `${pluralize(warnings.length, "PliantRoot")} can't be matched with a PliantPrePaint.`,
      fix: "Render PliantRoot and PliantPrePaint in the route's page or layout, with the surface as a string or a const.",
      problems: warnings,
    }
  }
  return {
    name: "pre-paint",
    status: "pass",
    message: `${pluralize(roots.length, "PliantRoot")} ${roots.length === 1 ? "has" : "have"} a PliantPrePaint with the same surface.`,
  }
}
