import { use, useMemo } from "react"

import { PliantMessagesContext, type PliantMessages } from "./pliant-messages"

/**
 * The text a component shows: its English `defaults`, with the entries
 * given to the nearest `PliantRoot`'s `messages` in their place. Pass a
 * constant defined outside the component, so the result changes only when
 * the messages do. Outside a `PliantRoot`, it returns the defaults.
 *
 * @experimental
 */
export function usePliantMessages<TKey extends keyof PliantMessages>(
  defaults: Pick<PliantMessages, TKey>
): Pick<PliantMessages, TKey> {
  const messages = use(PliantMessagesContext)
  return useMemo(() => ({ ...defaults, ...messages }), [defaults, messages])
}
