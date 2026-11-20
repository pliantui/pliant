/**
 * Compares two strings by Unicode code point. JavaScript's `<` compares
 * UTF-16 code units, which puts characters above U+FFFF before U+E000 to
 * U+FFFF, so the first unit that differs is remapped to restore code point
 * order.
 */
export function compareCodePoints(a: string, b: string): number {
  let index = 0
  while (index < a.length && a.charCodeAt(index) === b.charCodeAt(index)) {
    index++
  }
  if (index === a.length || index === b.length) {
    return a.length === b.length ? 0 : index === a.length ? -1 : 1
  }
  return rank(a.charCodeAt(index)) - rank(b.charCodeAt(index))
}

function rank(unit: number) {
  if (unit >= 0xe000) {
    return unit - 0x800
  }
  return unit >= 0xd800 ? unit + 0x2000 : unit
}
