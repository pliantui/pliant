import {
  compareData,
  compileTableState,
  type CompiledTableState,
  type CompileTableStateOptions,
  type ResolvedLayers,
} from "@pliantui/core"

/**
 * Remembers a table's last compiled state, so each render, snapshot and
 * handler compiles once per resolved layers, and each slice keeps its
 * object while it is unchanged, whatever the options' identity.
 */
export function createTableCache() {
  let compiled:
    | {
        readonly resolved: ResolvedLayers
        readonly key: string
        readonly state: CompiledTableState
      }
    | undefined
  return {
    compile(
      resolved: ResolvedLayers,
      options: Omit<CompileTableStateOptions, "previous">,
      key: string
    ) {
      if (compiled?.resolved !== resolved || compiled.key !== key) {
        compiled = {
          resolved,
          key,
          state: compileTableState(resolved, {
            ...options,
            previous: compiled?.state,
          }),
        }
      }
      return compiled.state
    },
  }
}

/**
 * A function that returns `derive()`, computed again only when one of
 * `inputs` is a different value, and the same object as last time while it
 * is equal as data.
 */
export function createDerived<T>() {
  let last:
    { readonly inputs: readonly unknown[]; readonly value: T } | undefined
  return (inputs: readonly unknown[], derive: () => T): T => {
    if (
      last?.inputs.length === inputs.length &&
      inputs.every((input, index) => input === last?.inputs[index])
    ) {
      return last.value
    }
    const value = derive()
    last = {
      inputs,
      value:
        last !== undefined && compareData(last.value, value) === 0
          ? last.value
          : value,
    }
    return last.value
  }
}
