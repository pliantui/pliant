import * as z from "zod"

import { addressSchema } from "../address"

const keyPattern =
  "(?:[a-z0-9]|f(?:[1-9]|1[0-2])|enter|escape|space|tab|backspace|delete|home|end|pageup|pagedown|arrow(?:up|down|left|right)|[,./;'`=\\-\\[\\]\\\\])"

export const actionsOpSchemas = {
  promote: z.strictObject({
    op: z.literal("promote"),
    target: addressSchema,
  }),
  demote: z.strictObject({
    op: z.literal("demote"),
    target: addressSchema,
  }),
  bindShortcut: z.strictObject({
    op: z.literal("bindShortcut"),
    target: addressSchema,
    keys: z
      .string()
      .max(64)
      .regex(
        new RegExp(
          `^(?:mod\\+)?(?:ctrl\\+)?(?:alt\\+)?(?:shift\\+)?(?:meta\\+)?${keyPattern}$`
        ),
        "Must be modifiers in the order mod, ctrl, alt, shift, meta, then a key, joined by +"
      ),
  }),
}
