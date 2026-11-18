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

/**
 * A conservative check for asks that change data rather than the view, such as
 * "delete the cancelled orders" or "email this customer". It only matches a
 * leading data verb, and never when the ask mentions a part of the view, so
 * anything it lets through still reaches the model.
 */
export function isOutOfScope(prompt: string) {
  const ask = prompt.toLowerCase().replace(/\s+/g, " ").trim()
  return dataVerb.test(ask) && !viewNoun.test(ask)
}
