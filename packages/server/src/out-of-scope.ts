import type { AskContext } from "./ask-request"

export const outOfScopeMessage =
  "This panel changes how the page looks, not the data."

const politeness =
  "(?:(?:please|pls|kindly|can you|could you|would you|will you|go ahead and|i want to|i'd like to|i would like to)\\s+)*"

// Only verbs that can't describe a change to the view. Ambiguous ones such as
// "remove", "send", "cancel", "update" and "restore" are left to the model
// ("remove the filter", "send overdue to the top", "restore the order").
const dataVerbs = [
  "delete",
  "erase",
  "purge",
  "wipe",
  "email",
  "e-mail",
  "refund",
  "pay",
  "charge",
  "approve",
  "reject",
]

const dataVerb = new RegExp(`^${politeness}(?:${dataVerbs.join("|")})\\b`)

const viewNoun =
  /\b(?:columns?|cards?|slots?|sections?|panels?|filters?|sort(?:ing)?|order(?:ing)? of|views?|layout|width|widths|density|labels?|headers?|charts?)\b/

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// A data verb can also be an item's or field's name ("email first" on a
// table with an Email column), so an ask that starts with one is left to
// the model. A name later in the ask ("email this customer") is the object of
// the verb, so it doesn't count.
function startsWithName(ask: string, { collection, fields }: AskContext) {
  const names = [...(collection?.items ?? []), ...(fields ?? [])].flatMap(
    ({ id, label }) => (label === undefined ? [id] : [id, label])
  )
  return names.some((name) =>
    new RegExp(
      `^${politeness}${escape(name.toLowerCase().replace(/\s+/g, " "))}(?:\\W|$)`
    ).test(ask)
  )
}

/**
 * A conservative check for asks that change data rather than the view, such as
 * "delete the cancelled orders" or "email this customer". It only matches a
 * leading data verb. It lets through asks that mention a part of the view
 * ("delete the notes column") or start with the name of one of the target's
 * items or fields ("email first" or "refund due, highest first" on a table
 * with Email and Refund due columns), so those still reach the model.
 */
export function isOutOfScope(prompt: string, context: AskContext) {
  const ask = prompt.toLowerCase().replace(/\s+/g, " ").trim()
  return (
    dataVerb.test(ask) && !viewNoun.test(ask) && !startsWithName(ask, context)
  )
}
