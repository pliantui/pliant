/**
 * Writes a value for an error message: as JSON where it has a JSON form,
 * and as `String(value)` otherwise, such as for a `bigint` or a symbol.
 */
export function quote(value: unknown): string {
  try {
    // Undefined for undefined, a function or a symbol, despite its type.
    const json: unknown = JSON.stringify(value)
    if (typeof json === "string") {
      return json
    }
  } catch {
    // A bigint, or an object whose toJSON throws.
  }
  try {
    return String(value)
  } catch {
    return Object.prototype.toString.call(value)
  }
}
