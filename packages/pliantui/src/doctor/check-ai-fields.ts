import type { SourceFile } from "ts-morph"

import type { Diagnostic } from "../utils/diagnostic"
import { pluralize } from "../utils/pluralize"
import { problemsOf, type Check, type Problem } from "./check"
import { readDatasets, type DatasetFieldReport } from "./read-datasets"
import { looksSensitive } from "./sensitive-field"

interface DatasetDetail extends Diagnostic {
  /** `null` when the id can't be read. */
  dataset: string | null
  fields: (DatasetFieldReport & { sensitive: boolean })[]
}

function listFields(fields: readonly DatasetFieldReport[]) {
  return fields
    .map(({ name, type }) => (type === null ? name : `${name} (${type})`))
    .join(", ")
}

/**
 * Lists the fields of each dataset that the model is told about, and warns
 * about the ones whose names look sensitive or that can't be read.
 */
export function checkAiFields(sourceFiles: readonly SourceFile[]): Check {
  const datasets = readDatasets(sourceFiles)
  if (datasets.length === 0) {
    return {
      name: "ai-fields",
      status: "skip",
      message:
        "No defineDataset from @pliantui/server/data found in this project.",
    }
  }

  const details: DatasetDetail[] = []
  const sensitive: Problem[] = []
  const unreadable: Diagnostic[] = []
  for (const dataset of datasets) {
    const name = dataset.id ?? "This dataset"
    const exposed = dataset.fields.filter((field) => field.exposeToAI)
    const hidden = dataset.fields.filter((field) => !field.exposeToAI)
    details.push({
      file: dataset.file,
      line: dataset.line,
      message: [
        exposed.length > 0
          ? `${name} shows the AI ${listFields(exposed)}.`
          : `${name} shows the AI no fields.`,
        ...(hidden.length > 0 ? [`Hidden: ${listFields(hidden)}.`] : []),
      ].join(" "),
      dataset: dataset.id,
      fields: dataset.fields.map((field) => ({
        ...field,
        sensitive: looksSensitive(field.name, field.type),
      })),
    })
    for (const field of exposed) {
      if (looksSensitive(field.name, field.type)) {
        sensitive.push({
          file: dataset.file,
          line: field.line,
          message: `${field.name}${dataset.id === null ? "" : ` in ${dataset.id}`} looks sensitive and is visible to the AI.`,
          status: "warn",
        })
      }
    }
    unreadable.push(...dataset.unreadable)
  }

  const exposedCount = datasets.reduce(
    (count, dataset) =>
      count + dataset.fields.filter((field) => field.exposeToAI).length,
    0
  )
  const visible = `${pluralize(exposedCount, "field")} in ${pluralize(datasets.length, "dataset")} ${exposedCount === 1 ? "is" : "are"} visible to the AI`
  if (sensitive.length === 0 && unreadable.length === 0) {
    return {
      name: "ai-fields",
      status: "pass",
      message: `${visible}, and none look sensitive.`,
      details,
    }
  }
  const findings = [
    ...(sensitive.length > 0
      ? [
          `${pluralize(sensitive.length, "field")} ${sensitive.length === 1 ? "looks" : "look"} sensitive`,
        ]
      : []),
    ...(unreadable.length > 0
      ? [
          pluralize(
            unreadable.length,
            "definition can't be read",
            "definitions can't be read"
          ),
        ]
      : []),
  ]
  return {
    name: "ai-fields",
    status: "warn",
    message: `${visible}: ${findings.join(", and ")}.`,
    fix: [
      "Set exposeToAI: false on each field the AI shouldn't see. The AI is told field names and types, never row values.",
      ...(unreadable.length > 0
        ? [
            "Write each dataset's fields as an object literal in the defineDataset call, so doctor can read them.",
          ]
        : []),
    ].join(" "),
    problems: [...sensitive, ...problemsOf("warn", unreadable)],
    details,
  }
}
