import { UnfinishedDot } from "@/components/unfinished-dot"

// Heads the status of an answer that was written by hand rather than
// recorded from a model, so it's never mistaken for a recording.
export function ScriptedAnswerLabel() {
  return (
    <span className="flex items-center gap-1.5 font-medium">
      Scripted answer
      <UnfinishedDot kind="scripted" />
    </span>
  )
}
