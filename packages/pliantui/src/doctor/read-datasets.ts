import { SyntaxKind, type Node, type SourceFile } from "ts-morph"

import { isPliantExport } from "../scan/pliant-export"
import { createDiagnostic, type Diagnostic } from "../utils/diagnostic"
import {
  readLiteral,
  readObject,
  resolveExpression,
} from "../utils/read-static"

export interface DatasetFieldReport {
  name: string
  /** `null` when the type can't be read. */
  type: string | null
  /** A field the model is told about unless it sets `exposeToAI: false`. */
  exposeToAI: boolean
  line: number
}

export interface DatasetReport {
  /** `null` when the id can't be read. */
  id: string | null
  file: string
  line: number
  fields: DatasetFieldReport[]
  /** What can't be read, so may name more fields the model sees. */
  unreadable: Diagnostic[]
}

function nameOf(id: string | null) {
  return id === null ? "this dataset" : `dataset "${id}"`
}

function readField(
  name: string,
  value: Node,
  dataset: string
): { field: DatasetFieldReport; unreadable?: Diagnostic } {
  const object = readObject(resolveExpression(value))
  const type = object?.entries.get("type")
  const typeValue = type === undefined ? undefined : readLiteral(type)
  const field: DatasetFieldReport = {
    name,
    type: typeof typeValue === "string" ? typeValue : null,
    exposeToAI: true,
    line: value.getStartLineNumber(),
  }
  const expose = object?.entries.get("exposeToAI")
  const exposeValue = expose === undefined ? true : readLiteral(expose)
  if (
    !object ||
    object.problems.length > 0 ||
    typeof exposeValue !== "boolean"
  ) {
    return {
      field,
      unreadable: createDiagnostic(
        value,
        `Field ${name} of ${dataset} can't be read, so it counts as visible to the AI.`
      ),
    }
  }
  return { field: { ...field, exposeToAI: exposeValue } }
}

function readDataset(call: Node, definition: Node | undefined): DatasetReport {
  const object = definition
    ? readObject(resolveExpression(definition))
    : undefined
  const idNode = object?.entries.get("id")
  const idValue = idNode === undefined ? undefined : readLiteral(idNode)
  const id = typeof idValue === "string" ? idValue : null
  const report: DatasetReport = {
    id,
    file: call.getSourceFile().getFilePath(),
    line: call.getStartLineNumber(),
    fields: [],
    unreadable: [],
  }
  const dataset = nameOf(id)
  const fieldsNode = object?.entries.get("fields")
  const fields = fieldsNode
    ? readObject(resolveExpression(fieldsNode))
    : undefined
  if (!fieldsNode || !fields) {
    report.unreadable.push(
      createDiagnostic(
        fieldsNode ?? definition ?? call,
        `The fields of ${dataset} can't be read, so they all count as visible to the AI.`
      )
    )
    return report
  }
  for (const { node, reason } of fields.problems) {
    report.unreadable.push(
      createDiagnostic(
        node,
        `The fields of ${dataset} include ${reason}, which can't be read, so the fields it adds count as visible to the AI.`
      )
    )
  }
  for (const [name, value] of fields.entries) {
    const { field, unreadable } = readField(name, value, dataset)
    report.fields.push(field)
    if (unreadable) {
      report.unreadable.push(unreadable)
    }
  }
  return report
}

/**
 * Finds each `defineDataset` call from `@pliantui/server/data`, through
 * renamed imports and re-exports, and reads which of its fields the model
 * is told about, without running anything.
 */
export function readDatasets(sourceFiles: readonly SourceFile[]) {
  return sourceFiles.flatMap((sourceFile) =>
    sourceFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((call) =>
        isPliantExport(
          call.getExpression(),
          "@pliantui/server/data",
          "defineDataset"
        )
      )
      .map((call) => readDataset(call, call.getArguments()[0]))
  )
}
