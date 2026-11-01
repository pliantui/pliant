import * as z from "zod"

import { addressSchema } from "../address"
import { itemIdSchema } from "../identifier"

const keyPattern =
  "(?:[a-z0-9]|f(?:[1-9]|1[0-2])|enter|escape|space|tab|backspace|delete|home|end|pageup|pagedown|arrow(?:up|down|left|right))"

export const actionsOpSchemas = [
  z.object({
    op: z.literal("promote"),
    target: addressSchema,
    action: itemIdSchema,
  }),
  z.object({
    op: z.literal("demote"),
    target: addressSchema,
    action: itemIdSchema,
  }),
  z.object({
    op: z.literal("bindShortcut"),
    target: addressSchema,
    action: itemIdSchema,
    keys: z
      .string()
      .max(64)
      .regex(
        new RegExp(`^(?:(?:mod|ctrl|alt|shift|meta)\\+){0,4}${keyPattern}$`),
        "Must be modifiers and a key joined by +, for example mod+shift+k"
      ),
  }),
] as const
