import type { ColumnSizeLimits } from "@pliantui/core"

interface StandardSchema {
  readonly "~standard": {
    readonly validate: (value: unknown) => unknown
  }
}

/** What Pliant reads from a TanStack column def. */
export interface TableColumn {
  readonly id: string
  /** The width without a `columnSizing` entry. */
  readonly size: number
  readonly limits: ColumnSizeLimits
  /** Whether the column has its own `filterFn`, rather than Pliant's. */
  readonly ownFilter: boolean
  /** `meta.pliant.filterValue`: the values the own `filterFn` reads. */
  readonly filterValue: StandardSchema | undefined
}

function read(source: unknown, key: string): unknown {
  return typeof source === "object" && source !== null
    ? Reflect.get(source, key)
    : undefined
}

function number(value: unknown) {
  return typeof value === "number" ? value : undefined
}

function isStandardSchema(value: unknown): value is StandardSchema {
  return typeof read(read(value, "~standard"), "validate") === "function"
}

/**
 * The leaf columns of TanStack column defs, in definition order, with ids
 * as TanStack derives them: `id`, else `accessorKey` with dots as
 * underscores, else a string `header`. Defs without one are left out.
 */
export function tableColumnsOf(
  defs: unknown,
  defaultColumn: unknown
): TableColumn[] {
  if (!Array.isArray(defs)) {
    return []
  }
  return defs.flatMap((def: unknown): TableColumn[] => {
    const children = read(def, "columns")
    if (Array.isArray(children)) {
      return tableColumnsOf(children, defaultColumn)
    }
    const accessorKey = read(def, "accessorKey")
    const header = read(def, "header")
    const id =
      read(def, "id") ??
      (typeof accessorKey === "string" || typeof accessorKey === "number"
        ? String(accessorKey).replaceAll(".", "_")
        : undefined) ??
      (typeof header === "string" ? header : undefined)
    if (typeof id !== "string") {
      return []
    }
    const option = (key: string) => read(def, key) ?? read(defaultColumn, key)
    const filterFn = option("filterFn")
    const filterValue = read(read(read(def, "meta"), "pliant"), "filterValue")
    return [
      {
        id,
        size: number(option("size")) ?? 150,
        limits: {
          minSize: number(option("minSize")),
          maxSize: number(option("maxSize")),
        },
        ownFilter:
          filterFn !== undefined &&
          !(typeof filterFn === "string" && filterFn.startsWith("pliant:")),
        filterValue: isStandardSchema(filterValue) ? filterValue : undefined,
      },
    ]
  })
}

/**
 * A raw value as the `custom` value a column's schema accepts, when it does
 * so synchronously.
 */
export function customValueOf(
  { filterValue }: TableColumn,
  value: unknown
): { readonly value: unknown } | undefined {
  if (!filterValue) {
    return undefined
  }
  const result = filterValue["~standard"].validate(value)
  return result instanceof Promise || read(result, "issues") !== undefined
    ? undefined
    : { value: read(result, "value") }
}
