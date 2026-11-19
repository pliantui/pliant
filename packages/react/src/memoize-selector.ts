/**
 * Wraps a selector so it runs once per input, and keeps returning its last
 * result while `isEqual` says a new one is the same.
 */
export function memoizeSelector<Input extends object, Output>(
  selector: (input: Input) => Output,
  isEqual: (a: Output, b: Output) => boolean
) {
  let last: { input: Input; output: Output } | undefined
  return (input: Input) => {
    if (last?.input !== input) {
      const output = selector(input)
      last = {
        input,
        output: last && isEqual(last.output, output) ? last.output : output,
      }
    }
    return last.output
  }
}
