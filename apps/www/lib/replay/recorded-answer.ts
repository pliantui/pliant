// A demo ask and the answer its recording replays to, without the parts
// each ask fills in: the overlay's id, surface and dates.
export interface RecordedAnswer {
  target: string
  prompt: string
  answer:
    | { status: "ok"; ops: unknown[]; basis: unknown; explain: string[] }
    | { status: "clarify"; question: string }
}
