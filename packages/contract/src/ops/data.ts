import * as z from "zod"

import { itemAddressSchema, nodeAddressSchema } from "../address"
import { expressionSchema } from "../expression"
import { filterSchema } from "../filter"
import { formatSchema } from "../format"
import { itemIdSchema, registeredNameSchema } from "../identifier"
import { labelSchema } from "../label"
import { sortSchema } from "../sort"
import { uniqueArray } from "../unique"

export const dataOpSchemas = {
  setSort: z.strictObject({
    op: z.literal("setSort"),
    target: nodeAddressSchema(),
    sort: sortSchema,
  }),
  setFilter: z.strictObject({
    op: z.literal("setFilter"),
    target: nodeAddressSchema(),
    filter: filterSchema,
  }),
  clearFilter: z.strictObject({
    op: z.literal("clearFilter"),
    target: nodeAddressSchema(),
    field: itemIdSchema,
  }),
  setPage: z.strictObject({
    op: z.literal("setPage"),
    target: nodeAddressSchema(),
    index: z.int().min(0),
    size: z.int().min(1).max(1000).optional(),
  }),
  setGroupBy: z.strictObject({
    op: z.literal("setGroupBy"),
    target: nodeAddressSchema(),
    fields: uniqueArray(itemIdSchema).max(4),
  }),
  addDerived: z.strictObject({
    op: z.literal("addDerived"),
    target: nodeAddressSchema(),
    id: itemIdSchema,
    label: labelSchema,
    expr: expressionSchema,
    format: formatSchema.optional(),
  }),
  addAggregate: z.strictObject({
    op: z.literal("addAggregate"),
    target: nodeAddressSchema(),
    id: itemIdSchema,
    label: labelSchema,
    expr: expressionSchema,
  }),
  formatField: z.strictObject({
    op: z.literal("formatField"),
    target: nodeAddressSchema(),
    field: itemIdSchema,
    format: formatSchema,
  }),
  addHighlight: z.strictObject({
    op: z.literal("addHighlight"),
    target: nodeAddressSchema(),
    id: itemIdSchema,
    when: expressionSchema,
    tone: z.enum(["emphasis", "success", "warning", "danger"]),
  }),
  addSortOption: z.strictObject({
    op: z.literal("addSortOption"),
    target: nodeAddressSchema(),
    id: itemIdSchema,
    label: labelSchema,
    sort: sortSchema.min(1),
  }),
  addFilterControl: z.strictObject({
    op: z.literal("addFilterControl"),
    target: nodeAddressSchema(),
    id: itemIdSchema,
    field: itemIdSchema,
    control: z.union([
      z.enum([
        "select",
        "multi-select",
        "search",
        "range",
        "date-range",
        "toggle",
      ]),
      registeredNameSchema,
    ]),
    label: labelSchema.optional(),
  }),
  addPreset: z.strictObject({
    op: z.literal("addPreset"),
    target: nodeAddressSchema(),
    id: itemIdSchema,
    label: labelSchema,
    filters: z.array(filterSchema).min(1).max(8),
    sort: sortSchema.optional(),
  }),
  setViewKind: z.strictObject({
    op: z.literal("setViewKind"),
    target: nodeAddressSchema(),
    kind: z.union([
      z.enum(["table", "chart", "stat", "list"]),
      registeredNameSchema,
    ]),
  }),
  configureChart: z.strictObject({
    op: z.literal("configureChart"),
    target: nodeAddressSchema(),
    type: z.enum(["area", "bar", "line", "pie", "radar", "radial"]),
    x: itemIdSchema,
    y: uniqueArray(itemIdSchema).min(1).max(8),
    series: itemIdSchema.optional(),
    stacking: z.enum(["none", "stacked", "percent"]).optional(),
    format: formatSchema.optional(),
  }),
  configureStat: z.strictObject({
    op: z.literal("configureStat"),
    target: nodeAddressSchema(),
    metric: itemIdSchema,
    comparison: z
      .strictObject({
        metric: itemIdSchema,
        display: z.enum(["difference", "percent"]),
      })
      .optional(),
    format: formatSchema.optional(),
  }),
  removeUserItem: z.strictObject({
    op: z.literal("removeUserItem"),
    target: nodeAddressSchema(),
    id: itemIdSchema,
  }),
  setColumnWidth: z.strictObject({
    op: z.literal("setColumnWidth"),
    target: itemAddressSchema("columns"),
    width: z.int().min(16).max(2000),
  }),
}
