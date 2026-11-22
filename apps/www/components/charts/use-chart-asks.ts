"use client"

import {
  useScriptedAsks,
  type ScriptedAsksState,
} from "@/components/demo/use-scripted-asks"

// The ask that makes a chart from a table or dashboard, and the follow-up
// asks that reshape the chart it made. Taking the first ask back removes
// the chart, and with it the follow-ups.
export function useChartAsks(chartAsk: string) {
  const first = useScriptedAsks()
  const reshape = useScriptedAsks()
  const charted = first.has(chartAsk)
  const chart: ScriptedAsksState = {
    ...first,
    ask: (prompt) => {
      if (prompt === chartAsk && charted) reshape.reset()
      first.ask(prompt)
    },
  }
  return { chart, reshape, charted }
}
