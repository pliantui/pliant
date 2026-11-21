import type { Flags } from "@pliantui/contract"
import type { FieldSchema } from "@pliantui/core"

/** A form's field schemas by field name. */
type FieldSchemas = Readonly<Record<string, FieldSchema>>

interface FieldOptions {
  readonly fields: Readonly<Record<string, FieldSchema>>
  readonly flags: Readonly<Record<string, Flags>>
}

export interface FieldRegistry {
  /** The `fields` and `flags` core resolves with, for the mounted forms. */
  readonly options: () => FieldOptions
  /**
   * Counts the schemas of the form `id` as mounted until the returned
   * function is called. The latest registration of a form wins.
   */
  readonly register: (id: string, schemas: FieldSchemas) => () => void
}

// A field is required when its schema rejects a missing value. A schema
// that validates asynchronously can't tell here, so it counts as required:
// hiding a field that turns out to be required is the worse mistake.
function isRequired(schema: FieldSchema) {
  const result = schema["~standard"].validate(undefined)
  return result instanceof Promise || result.issues !== undefined
}

/**
 * Tracks the field schemas of the forms mounted on a surface, which core
 * checks defaults against and reads required fields from. `onChange` is
 * called when they change.
 */
export function createFieldRegistry(onChange: () => void): FieldRegistry {
  const mounted = new Map<string, { schemas: FieldSchemas; count: number }>()
  let options: FieldOptions = { fields: {}, flags: {} }

  function update() {
    const fields: Record<string, FieldSchema> = {}
    const flags: Record<string, Flags> = {}
    for (const [id, { schemas }] of mounted) {
      for (const [name, schema] of Object.entries(schemas)) {
        fields[`${id}/fields/${name}`] = schema
        if (isRequired(schema)) {
          flags[`${id}/fields/${name}`] = { required: true }
        }
      }
    }
    options = { fields, flags }
    onChange()
  }

  return {
    options: () => options,
    register(id, schemas) {
      const current = mounted.get(id)
      mounted.set(id, { schemas, count: (current?.count ?? 0) + 1 })
      if (current?.schemas !== schemas) {
        update()
      }
      let registered = true
      return () => {
        if (!registered) {
          return
        }
        registered = false
        const entry = mounted.get(id)
        if (entry && entry.count > 1) {
          entry.count--
        } else {
          mounted.delete(id)
          update()
        }
      }
    },
  }
}
