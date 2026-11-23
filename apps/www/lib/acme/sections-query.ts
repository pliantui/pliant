import "server-only"

import type { Filter } from "@pliantui/contract"
import { authorizeDataset, defineDataset } from "@pliantui/server/data"
import { compileQuery, type CompiledQuery } from "@pliantui/server/sql"

import { scriptedAnswers } from "@/lib/replay/scripted-answers"

import { sectionStatuses, sectionTypes } from "./data"

interface User {
  id: string
  workspaceId: string
}

// The sections as the Acme app's server defines them: each workspace sees
// only its own.
const sectionsDataset = defineDataset({
  id: "sections",
  describe: "The sections of a proposal, one row per section.",
  timeZone: "UTC",
  fields: {
    id: { type: "integer", label: "Id" },
    header: { type: "string", label: "Header" },
    type: { type: "enum", label: "Section type", values: sectionTypes },
    status: { type: "enum", label: "Status", values: sectionStatuses },
    target: { type: "integer", label: "Target" },
    limit: { type: "integer", label: "Limit" },
    reviewer: { type: "string", label: "Reviewer" },
  },
  scope: (user: User) => ({ workspace_id: user.workspaceId }),
})

const user: User = { id: "eddie", workspaceId: "acme" }

export interface SectionsQuery {
  // The filters an ask set, which the query compiles.
  filters: Filter[]
  query: CompiledQuery
}

// The query a server-mode sections table would run for the filters of each
// scripted ask that sets some. Pliant's own compiler writes it, so every
// value is a parameter.
export function getSectionsQueries(): { asks: SectionsQuery[] } {
  const grant = authorizeDataset(sectionsDataset, user)
  if (!grant) throw new Error("The demo user can't read the sections")
  const compile = (filters: Filter[]) =>
    compileQuery(
      sectionsDataset,
      grant,
      { dataset: "sections", filters, page: { index: 0, size: 10 } },
      { table: "sections" }
    )
  const asks = scriptedAnswers
    .filter((answer) => answer.target === "acme-sections")
    .map((answer) =>
      answer.ops.flatMap((op) => (op.op === "setFilter" ? [op.filter] : []))
    )
    .filter((filters) => filters.length > 0)
    .map((filters) => ({ filters, query: compile(filters) }))
  return { asks }
}
