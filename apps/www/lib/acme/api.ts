import { scriptedAnswers } from "@/lib/replay/scripted-answers"

import { lastDay, monthlyFigures, sections, visitors } from "./data"

function findSampleAsk() {
  const answer = scriptedAnswers.find(
    (entry) =>
      entry.target === "acme-sections" && entry.ops[0]?.op === "setGroupBy"
  )
  if (!answer) throw new Error("No grouping ask to show")
  return answer
}

const sampleAsk = findSampleAsk()

// The Acme app's own API, as the showcase's Data tab shows it: what each
// part of the dashboard loads. In the showcase, the responses come from the
// page's data rather than a server.
export interface ApiCall {
  id: "metrics" | "visitors" | "sections" | "ask"
  method: "GET" | "POST"
  path: string
  // The part of the dashboard that makes the call.
  usedBy: string
  request?: unknown
  response: unknown
}

export const apiCalls: ApiCall[] = [
  {
    id: "metrics",
    method: "GET",
    path: "/api/metrics?months=2",
    usedBy: "Metric cards",
    response: { months: monthlyFigures.slice(-2) },
  },
  {
    id: "visitors",
    method: "GET",
    path: "/api/visitors?days=90",
    usedBy: "Total Visitors chart",
    response: {
      to: lastDay,
      days: [...visitors.slice(-3)],
      more: visitors.length - 3,
    },
  },
  {
    id: "sections",
    method: "GET",
    path: "/api/sections",
    usedBy: "Sections table",
    response: {
      rows: sections.slice(0, 2),
      more: sections.length - 2,
      total: sections.length,
    },
  },
  {
    id: "ask",
    method: "POST",
    path: "/api/pliant/ask",
    usedBy: "Suggested asks",
    request: {
      surface: "/",
      target: sampleAsk.target,
      prompt: sampleAsk.prompt,
    },
    response: {
      status: "ok",
      overlay: { ops: sampleAsk.ops, explain: sampleAsk.explain },
    },
  },
]
