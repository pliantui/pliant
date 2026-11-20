/**
 * Compares two strings by Unicode code point. JavaScript's `<` compares
 * UTF-16 code units, which puts characters above U+FFFF before U+E000 to
 * U+FFFF, so the code points where the strings first differ are compared.
 * A lone surrogate counts as its own code point.
 */
export function compareCodePoints(a: string, b: string): number {
  let index = 0
  while (index < a.length && a.charCodeAt(index) === b.charCodeAt(index)) {
    index++
  }
  if (index === a.length || index === b.length) {
    return a.length - b.length
  }
  // The strings may differ in the second half of a surrogate pair.
  if (
    isSurrogate(a.charCodeAt(index - 1), 0xd800) &&
    (isSurrogate(a.charCodeAt(index), 0xdc00) ||
      isSurrogate(b.charCodeAt(index), 0xdc00))
  ) {
    index--
  }
  return (a.codePointAt(index) ?? 0) - (b.codePointAt(index) ?? 0)
}

/** Whether a code unit is a high (from 0xd800) or low (from 0xdc00) surrogate. */
export function isSurrogate(unit: number, first: number) {
  return unit >= first && unit < first + 0x400
}
