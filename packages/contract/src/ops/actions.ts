import * as z from "zod"

import { itemAddressSchema } from "../address"

const keyPattern =
  "(?:[a-z0-9]|f(?:[1-9]|1[0-2])|enter|escape|space|tab|backspace|delete|home|end|pageup|pagedown|arrow(?:up|down|left|right)|[,./;'`=\\-\\[\\]\\\\])"

export const actionsOpSchemas = {
  promote: z.strictObject({
    op: z.literal("promote"),
    target: itemAddressSchema("actions"),
  }),
  demote: z.strictObject({
    op: z.literal("demote"),
    target: itemAddressSchema("actions"),
  }),
  bindShortcut: z.strictObject({
    op: z.literal("bindShortcut"),
    target: itemAddressSchema("actions"),
    keys: z
      .string()
      .max(64)
      .regex(
        new RegExp(
          `^(?:mod\\+(?:alt\\+)?(?:shift\\+)?|(?:ctrl\\+)?(?:alt\\+)?(?:shift\\+)?(?:meta\\+)?)${keyPattern}$`
        ),
        "Must be modifiers in the order mod or ctrl, alt, shift, meta, then a key, joined by +"
      ),
  }),
}
