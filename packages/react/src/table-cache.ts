import {
  compileTableState,
  type CompiledTableState,
  type CompileTableStateOptions,
  type ResolvedLayers,
} from "@pliantui/core"

export interface ColumnFilter {
  readonly id: string
  readonly value: unknown
}

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
  let presented:
    | {
        readonly filters: readonly ColumnFilter[]
        readonly context: unknown
        readonly shown: ColumnFilter[]
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
    /**
     * The filters as TanStack sees them, each mapped by `show` or left out
     * when it returns `undefined`, then `extra`. The same array while
     * `filters` and `context` are, or while every shown value is the same.
     */
    present(
      filters: readonly ColumnFilter[],
      context: unknown,
      show: (filter: ColumnFilter) => { readonly value: unknown } | undefined,
      extra: () => readonly ColumnFilter[]
    ): ColumnFilter[] {
      if (presented?.filters === filters && presented.context === context) {
        return presented.shown
      }
      const shown = [
        ...filters.flatMap((filter) => {
          const mapped = show(filter)
          return mapped === undefined
            ? []
            : [
                mapped.value === filter.value
                  ? filter
                  : { id: filter.id, value: mapped.value },
              ]
        }),
        ...extra(),
      ]
      const last = presented?.shown
      const same =
        last?.length === shown.length &&
        shown.every((filter, index) => {
          const other = last[index]
          return other?.id === filter.id && other.value === filter.value
        })
      presented = { filters, context, shown: same ? last : shown }
      return presented.shown
    },
  }
}
