import * as z from "zod"

import { filterSchema, itemIdSchema, type Filter } from "@pliantui/contract"

const sortEntrySchema = z.strictObject({
  field: itemIdSchema,
  desc: z.boolean(),
  nulls: z.enum(["first", "last"]).optional(),
})

export const serverQuerySchema = z.strictObject({
  dataset: itemIdSchema,
  sort: z
    .array(sortEntrySchema)
    .max(8)
    .refine(
      (sort) => new Set(sort.map(({ field }) => field)).size === sort.length,
      "Must sort by each field at most once"
    )
    .optional(),
  filters: z.array(filterSchema).max(100).optional(),
  page: z.strictObject({
    index: z.int().min(0).max(1_000_000),
    size: z.int().min(1),
  }),
})

/**
 * One page of a dataset's rows, as a table in server mode asks for it: the
 * table's sort, its column filters and the page it shows.
 *
 * @experimental
 */
export interface ServerQuery {
  /** The dataset's id. */
  readonly dataset: string
  /**
   * The sort, most significant first: up to 8 fields, each at most once.
   * Rows without a value sort last in either direction unless `nulls` is
   * `"first"`. Rows that tie, and an unsorted query, are in ascending
   * order of the row key.
   */
  readonly sort?: readonly ServerQuerySort[] | undefined
  /** Up to 100 filters, each a filter a `setFilter` op sets. Rows pass all of them. */
  readonly filters?: readonly Filter[] | undefined
  /**
   * The page: `index` counts from 0, up to 1,000,000, and `size` is the
   * rows per page, capped at the compiler's maximum page size.
   */
  readonly page: { readonly index: number; readonly size: number }
}

/**
 * One field of a `ServerQuery`'s sort.
 *
 * @experimental
 */
export interface ServerQuerySort {
  readonly field: string
  readonly desc: boolean
  /** Where rows without a value go. Defaults to `"last"`, in either direction. */
  readonly nulls?: "first" | "last" | undefined
}
