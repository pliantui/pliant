import { createContext } from "react"

/**
 * The text Pliant shows to users, by key. Pass a part of it to
 * `PliantRoot`'s `messages` to replace the English defaults, for example to
 * translate them. An entry with values is a function that returns the text.
 *
 * Components add their own entries by augmenting this interface, and read
 * them, with their defaults, through `usePliantMessages`:
 *
 * ```ts
 * declare module "@pliantui/react" {
 *   interface PliantMessages {
 *     saveLabel: string
 *   }
 * }
 * ```
 *
 * @experimental
 */
export interface PliantMessages {
  /**
   * The ask panel's error when an ask is sent before the layers load.
   * Defaults to "The page is still loading. Try again in a moment."
   */
  askNotReady: string
  /**
   * The ask panel's error when `send` throws. Defaults to "Couldn't reach
   * the server. Check your connection."
   */
  askUnreachable: string
  /**
   * The ask panel's error when the answer fails to preview, given why, in
   * English. Defaults to "The answer couldn't be previewed: " and the error.
   */
  askPreviewFailed: (error: string) => string
  /**
   * The ask panel's error when locking in fails, given why, in English.
   * Defaults to the error itself.
   */
  askLockInFailed: (error: string) => string
  /**
   * What point mode announces when holding Alt turns it on. Defaults to
   * "Point mode on. Click the part you want to change."
   */
  pointModeOn: string
  /** What point mode announces when a hold ends. Defaults to "Point mode off." */
  pointModeOff: string
}

export const PliantMessagesContext = createContext<Partial<PliantMessages>>({})
