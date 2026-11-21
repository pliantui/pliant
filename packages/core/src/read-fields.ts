import { addressSchema } from "@pliantui/contract"

import type { FieldSchema } from "./field-schema"
import { isPlainObject } from "./is-plain-object"
import { identityOf } from "./node-identity"

const fieldAddress = /\/fields\/[^/]+$/

function isFieldSchema(value: unknown): value is FieldSchema {
  const standard: unknown =
    typeof value === "object" && value !== null
      ? Reflect.get(value, "~standard")
      : undefined
  return (
    typeof standard === "object" &&
    standard !== null &&
    typeof Reflect.get(standard, "validate") === "function"
  )
}

/**
 * Checks `fields` and reads the schemas by identity. `name` names the option
 * in errors.
 *
 * Throws a `TypeError` unless `fields` is a plain object whose keys are
 * field addresses and whose values are Standard Schema schemas, and when
 * two addresses name the same field.
 */
export function readFields(
  fields: unknown,
  name = "fields"
): ReadonlyMap<string, FieldSchema> {
  const read = new Map<string, FieldSchema>()
  if (fields === undefined) {
    return read
  }
  if (!isPlainObject(fields)) {
    throw new TypeError(`${name} must be a plain object of schemas by address`)
  }
  for (const [address, schema] of Object.entries(fields)) {
    if (
      !addressSchema.safeParse(address).success ||
      !fieldAddress.test(address) ||
      !isFieldSchema(schema)
    ) {
      throw new TypeError(
        `${name}["${address}"] must be a schema at a field address`
      )
    }
    const id = identityOf(address)
    if (read.has(id)) {
      throw new TypeError(`${name} gives ${id} two schemas`)
    }
    read.set(id, schema)
  }
  return read
}
