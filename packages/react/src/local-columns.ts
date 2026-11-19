import type { CompiledTableState } from "@pliantui/core"

/**
 * The state of columns whose ids aren't valid item ids, which no op can
 * name: kept in the table, not saved.
 */
export interface LocalColumns {
  readonly sorting?: CompiledTableState["sorting"] | undefined
  readonly grouping?: CompiledTableState["grouping"] | undefined
  readonly columnVisibility?: CompiledTableState["columnVisibility"] | undefined
  readonly columnSizing?: CompiledTableState["columnSizing"] | undefined
  readonly columnPinning?: CompiledTableState["columnPinning"] | undefined
  /** The last order the table reported with such a column in it. */
  readonly columnOrder?: CompiledTableState["columnOrder"] | undefined
}

type LocalSlice = keyof LocalColumns

export function isLocalSlice(slice: string): slice is LocalSlice {
  return [
    "sorting",
    "grouping",
    "columnVisibility",
    "columnSizing",
    "columnPinning",
    "columnOrder",
  ].includes(slice)
}

function read(source: unknown, key: string): unknown {
  return typeof source === "object" && source !== null
    ? Reflect.get(source, key)
    : undefined
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string")
    : []
}

function entriesOf(value: unknown) {
  return typeof value === "object" && value !== null
    ? Object.entries(value)
    : []
}

/**
 * Splits a slice the table reported into the part ops can save and the
 * part kept for `local` columns.
 */
export function splitLocal(
  slice: LocalSlice,
  value: unknown,
  local: (id: string) => boolean
): { readonly saved: unknown; readonly kept: LocalColumns } {
  switch (slice) {
    case "sorting": {
      const sorts = (Array.isArray(value) ? value : []).flatMap(
        (sort: unknown) => {
          const id = read(sort, "id")
          return typeof id === "string"
            ? [{ id, desc: read(sort, "desc") === true }]
            : []
        }
      )
      return {
        saved: sorts.filter(({ id }) => !local(id)),
        kept: { sorting: sorts.filter(({ id }) => local(id)) },
      }
    }
    case "grouping": {
      const ids = strings(value)
      return {
        saved: ids.filter((id) => !local(id)),
        kept: { grouping: ids.filter(local) },
      }
    }
    case "columnVisibility":
    case "columnSizing": {
      const entries = entriesOf(value)
      return {
        saved: Object.fromEntries(entries.filter(([id]) => !local(id))),
        kept: {
          [slice]: Object.fromEntries(
            entries.filter(
              ([id, item]) =>
                local(id) &&
                (slice === "columnSizing"
                  ? typeof item === "number"
                  : typeof item === "boolean")
            )
          ),
        },
      }
    }
    case "columnPinning": {
      const start = strings(read(value, "start"))
      const end = strings(read(value, "end"))
      return {
        saved: {
          start: start.filter((id) => !local(id)),
          end: end.filter((id) => !local(id)),
        },
        kept: {
          columnPinning: { start: start.filter(local), end: end.filter(local) },
        },
      }
    }
    case "columnOrder": {
      const ids = strings(value)
      return {
        saved: ids,
        kept: { columnOrder: ids.some(local) ? ids : undefined },
      }
    }
  }
}

function nonEmpty(value: object | undefined) {
  return value !== undefined && Object.keys(value).length > 0
}

// Each column the compiled order lacks goes after the column before it in
// the order the table last reported.
function withLocalOrder(order: readonly string[], reported: readonly string[]) {
  const result = [...order]
  reported.forEach((column, index) => {
    if (result.includes(column)) {
      return
    }
    const before = reported
      .slice(0, index)
      .findLast((other) => result.includes(other))
    result.splice(
      before === undefined ? 0 : result.indexOf(before) + 1,
      0,
      column
    )
  })
  return result
}

/** The compiled state with the `local` columns' state put back in. */
export function withLocal(
  state: CompiledTableState,
  local: LocalColumns
): CompiledTableState {
  const { sorting, grouping, columnVisibility, columnSizing, columnPinning } =
    local
  return {
    ...state,
    sorting: sorting?.length ? [...state.sorting, ...sorting] : state.sorting,
    grouping: grouping?.length
      ? [...state.grouping, ...grouping]
      : state.grouping,
    columnVisibility: nonEmpty(columnVisibility)
      ? { ...state.columnVisibility, ...columnVisibility }
      : state.columnVisibility,
    columnSizing: nonEmpty(columnSizing)
      ? { ...state.columnSizing, ...columnSizing }
      : state.columnSizing,
    columnPinning:
      columnPinning && columnPinning.start.length + columnPinning.end.length > 0
        ? {
            start: [...state.columnPinning.start, ...columnPinning.start],
            end: [...state.columnPinning.end, ...columnPinning.end],
          }
        : state.columnPinning,
    columnOrder: local.columnOrder
      ? withLocalOrder(state.columnOrder, local.columnOrder)
      : state.columnOrder,
  }
}
