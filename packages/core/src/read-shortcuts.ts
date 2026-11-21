import { opSchemas } from "@pliantui/contract"

const keysSchema = opSchemas.bindShortcut.shape.keys

/**
 * Checks `shortcuts`, keys in `bindShortcut`'s form. `name` names the option
 * in errors. Throws a `TypeError` unless it is an array of such keys.
 */
export function readShortcuts(
  shortcuts: unknown,
  name = "reservedShortcuts"
): readonly string[] {
  if (shortcuts === undefined) {
    return []
  }
  if (!Array.isArray(shortcuts)) {
    throw new TypeError(`${name} must be an array of keys`)
  }
  return shortcuts.map((keys: unknown, index) => {
    const parsed = keysSchema.safeParse(keys)
    if (!parsed.success) {
      throw new TypeError(
        `${name}[${String(index)}] must be keys as bindShortcut takes them`
      )
    }
    return parsed.data
  })
}
