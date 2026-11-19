/** Compares two values of one primitive type by `<`: strings by code unit. */
export function compareOrdered<T extends string | number | bigint | boolean>(
  a: T,
  b: T
): number {
  return a < b ? -1 : a > b ? 1 : 0
}
