import { use, useMemo } from "react"

import { PliantMessagesContext, type PliantMessages } from "./pliant-messages"

/**
 * The text a component shows: its English `defaults`, with the entries
 * given to the nearest `PliantRoot`'s `messages` in their place. Pass a
 * constant defined outside the component, so the result changes only when
 * the messages do. An entry set to `undefined` keeps its default. Outside a
 * `PliantRoot`, it returns the defaults.
 *
 * @experimental
 */
export function usePliantMessages<TKey extends keyof PliantMessages>(
  defaults: Pick<PliantMessages, TKey>
): Pick<PliantMessages, TKey> {
  const messages = use(PliantMessagesContext)
  return useMemo(
    () => ({
      ...defaults,
      ...Object.fromEntries(
        Object.entries<unknown>(messages).filter(
          ([, text]) => text !== undefined
        )
      ),
    }),
    [defaults, messages]
  )
}
