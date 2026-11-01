import * as z from "zod"

import { addressSchema } from "../address"
import { expressionSchema } from "../expression"
import { filterSchema, sortSchema } from "../filter"
import { formatSchema } from "../format"
import { itemIdSchema, labelSchema, registeredNameSchema } from "../identifier"

export const dataOpSchemas = [
  z.object({
    op: z.literal("setSort"),
    target: addressSchema,
    sort: sortSchema,
  }),
  z.object({
    op: z.literal("setFilter"),
    target: addressSchema,
    filter: filterSchema,
  }),
  z.object({
    op: z.literal("clearFilter"),
    target: addressSchema,
    field: itemIdSchema,
  }),
  z.object({
    op: z.literal("setPage"),
    target: addressSchema,
    index: z.int().min(0),
    size: z.int().min(1).max(1000).optional(),
  }),
  z.object({
    op: z.literal("setGroupBy"),
    target: addressSchema,
    fields: z.array(itemIdSchema).max(4),
  }),
  z.object({
    op: z.literal("addDerived"),
    target: addressSchema,
    id: itemIdSchema,
    label: labelSchema,
    expr: expressionSchema,
    format: formatSchema.optional(),
  }),
  z.object({
    op: z.literal("addAggregate"),
    target: addressSchema,
    id: itemIdSchema,
    label: labelSchema,
    expr: expressionSchema,
  }),
  z.object({
    op: z.literal("formatField"),
    target: addressSchema,
    field: itemIdSchema,
    format: formatSchema,
  }),
  z.object({
    op: z.literal("addHighlight"),
    target: addressSchema,
    id: itemIdSchema,
    when: expressionSchema,
    tone: z.enum(["emphasis", "success", "warning", "danger"]),
  }),
  z.object({
    op: z.literal("addSortOption"),
    target: addressSchema,
    id: itemIdSchema,
    label: labelSchema,
    sort: sortSchema.min(1),
  }),
  z.object({
    op: z.literal("addFilterControl"),
    target: addressSchema,
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
  z.object({
    op: z.literal("addPreset"),
    target: addressSchema,
    id: itemIdSchema,
    label: labelSchema,
    filters: z.array(filterSchema).min(1).max(8),
    sort: sortSchema.optional(),
  }),
  z.object({
    op: z.literal("setViewKind"),
    target: addressSchema,
    kind: z.union([
      z.enum(["table", "chart", "stat", "list"]),
      registeredNameSchema,
    ]),
  }),
  z.object({
    op: z.literal("configureChart"),
    target: addressSchema,
    type: z.enum(["area", "bar", "line", "pie", "radar", "radial"]),
    x: itemIdSchema,
    y: z.array(itemIdSchema).min(1).max(8),
    series: itemIdSchema.optional(),
    stacking: z.enum(["none", "stacked", "percent"]).optional(),
    format: formatSchema.optional(),
  }),
  z.object({
    op: z.literal("configureStat"),
    target: addressSchema,
    metric: itemIdSchema,
    comparison: z
      .object({
        metric: itemIdSchema,
        display: z.enum(["difference", "percent"]),
      })
      .optional(),
    format: formatSchema.optional(),
  }),
  z.object({
    op: z.literal("removeUserItem"),
    target: addressSchema,
    id: itemIdSchema,
  }),
  z.object({
    op: z.literal("setColumnWidth"),
    target: addressSchema,
    width: z.int().min(16).max(2000),
  }),
] as const
