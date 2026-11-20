import * as z from "zod"

import {
  filterSchema,
  opCatalog,
  type Capability,
  type Op,
  type OpName,
} from "@pliantui/contract"
import { formatError } from "@pliantui/core"

import type { AskContext } from "./ask-request"

type Expansion =
  | { success: true; ops: Op[]; explain: string[] }
  | { success: false; error: string }

/**
 * One compact tool the model can call. Tools are internal: the target is
 * implicit, items are bare ids, and `expand` turns a call into canonical ops.
 */
export interface OpTool {
  name: string
  description: string
  inputSchema: z.ZodType
  expand: (input: unknown) => Expansion
}

const explainSchema = z
  .string()
  .min(1)
  .max(200)
  .describe("One short sentence telling the user what changed")

const scalarSchema = z.union([z.string().max(200), z.number(), z.boolean()])

function hasCapability(context: AskContext, op: OpName) {
  const [capability, ...others] = new Set(opCatalog[op].capability)
  // Capabilities that differ by shape need the op's shape, which a name
  // doesn't give.
  if (capability === undefined || others.length > 0) {
    return false
  }
  return capability === null || isEnabled(context, capability)
}

function isEnabled(context: AskContext, capability: Capability) {
  const value = context.manifest.capabilities[capability]
  return value !== undefined && value !== false
}

function unknownValues(context: AskContext, field: string, value: unknown) {
  const values = context.fields?.find(({ id }) => id === field)?.values
  if (values === undefined || value === undefined) {
    return []
  }
  const list: unknown[] = Array.isArray(value) ? value : [value]
  return list.filter(
    (entry) => typeof entry !== "string" || !values.includes(entry)
  )
}

function defineTool<T extends z.ZodType>(
  name: string,
  description: string,
  inputSchema: T,
  expand: (input: z.output<T>) => Expansion
): OpTool {
  return {
    name,
    description,
    inputSchema,
    expand: (input) => {
      const result = inputSchema.safeParse(input)
      return result.success
        ? expand(result.data)
        : { success: false, error: formatError(result.error) }
    },
  }
}

function single(op: Op, explain: string): Expansion {
  return { success: true, ops: [op], explain: [explain] }
}

function idEnum(ids: readonly string[]) {
  const [first, ...rest] = ids
  return first === undefined ? undefined : z.enum([first, ...rest])
}

/**
 * Builds the tools for the ops the target's capabilities allow, limited to the
 * ops the demo supports. Item and field arguments are enums of the real ids in
 * the context, so the model can only name things that exist.
 */
export function createOpTools(target: string, context: AskContext): OpTool[] {
  const tools: OpTool[] = []
  const { collection } = context
  const itemIds = idEnum(collection?.items.map(({ id }) => id) ?? [])
  const fieldIds = idEnum(context.fields?.map(({ id }) => id) ?? [])
  const itemNoun = collection?.name === "columns" ? "column" : "slot"

  function itemAddress(id: string) {
    return `${target}/${collection?.name ?? "slots"}/${id}`
  }

  if (fieldIds && hasCapability(context, "setSort")) {
    tools.push(
      defineTool(
        "setSort",
        "Replace the sort. An empty list removes sorting.",
        z.strictObject({
          sort: z
            .array(
              z.strictObject({ field: fieldIds, dir: z.enum(["asc", "desc"]) })
            )
            .max(8),
          explain: explainSchema,
        }),
        ({ sort, explain }) => single({ op: "setSort", target, sort }, explain)
      )
    )
  }

  if (fieldIds && hasCapability(context, "setFilter")) {
    tools.push(
      defineTool(
        "setFilter",
        "Filter by one field, replacing any filter on that field. Use an array value for in and a two-item array for between; leave value out for isNull.",
        z.strictObject({
          field: fieldIds,
          // `custom` is left out: it needs the column's own value schema,
          // which the context doesn't carry.
          operator: z.enum([
            "eq",
            "neq",
            "contains",
            "startsWith",
            "gt",
            "gte",
            "lt",
            "lte",
            "in",
            "between",
            "isNull",
          ]),
          value: z
            .union([scalarSchema, z.array(scalarSchema).max(100)])
            .optional(),
          explain: explainSchema,
        }),
        ({ explain, ...input }) => {
          const unknown = unknownValues(context, input.field, input.value)
          if (unknown.length > 0) {
            return {
              success: false,
              error: `value: ${unknown.map((value) => JSON.stringify(value)).join(", ")} isn't one of the field's values`,
            }
          }
          const filter = filterSchema.safeParse(input)
          return filter.success
            ? single({ op: "setFilter", target, filter: filter.data }, explain)
            : { success: false, error: formatError(filter.error) }
        }
      )
    )
  }

  if (fieldIds && hasCapability(context, "clearFilter")) {
    tools.push(
      defineTool(
        "clearFilter",
        "Remove the filter on one field.",
        z.strictObject({ field: fieldIds, explain: explainSchema }),
        ({ field, explain }) =>
          single({ op: "clearFilter", target, field }, explain)
      )
    )
  }

  if (itemIds && hasCapability(context, "hide")) {
    tools.push(
      defineTool(
        "setVisible",
        `Show or hide ${itemNoun}s.`,
        z.strictObject({
          items: z.array(itemIds).min(1).max(50),
          visible: z.boolean(),
          explain: explainSchema,
        }),
        ({ items, visible, explain }) => {
          const unique = [...new Set(items)]
          return {
            success: true,
            ops: unique.map((id) => ({
              op: visible ? "show" : "hide",
              target: itemAddress(id),
            })),
            explain: unique.map(() => explain),
          }
        }
      )
    )
  }

  if (itemIds && hasCapability(context, "move")) {
    tools.push(
      defineTool(
        "move",
        `Move a ${itemNoun} before or after another, or to a zero-based index.`,
        z.strictObject({
          item: itemIds,
          to: z.union([
            z.strictObject({ before: itemIds }),
            z.strictObject({ after: itemIds }),
            z.strictObject({
              index: z
                .int()
                .min(0)
                .max((collection?.items.length ?? 1) - 1),
            }),
          ]),
          explain: explainSchema,
        }),
        ({ item, to, explain }) =>
          single({ op: "move", target: itemAddress(item), to }, explain)
      )
    )
  }

  if (itemIds && hasCapability(context, "pin")) {
    tools.push(
      defineTool(
        "pin",
        `Pin a ${itemNoun} to the start or end, make it sticky, or unpin it with none.`,
        z.strictObject({
          item: itemIds,
          where: z.enum(["start", "end", "sticky", "none"]),
          explain: explainSchema,
        }),
        ({ item, where, explain }) =>
          single({ op: "pin", target: itemAddress(item), where }, explain)
      )
    )
  }

  if (
    itemIds &&
    collection?.name === "columns" &&
    hasCapability(context, "setColumnWidth")
  ) {
    tools.push(
      defineTool(
        "setColumnWidth",
        "Set a column's width in pixels.",
        z.strictObject({
          column: itemIds,
          width: z.int().min(16).max(2000),
          explain: explainSchema,
        }),
        ({ column, width, explain }) =>
          single(
            { op: "setColumnWidth", target: itemAddress(column), width },
            explain
          )
      )
    )
  }

  if (hasCapability(context, "setLayout")) {
    tools.push(
      defineTool(
        "setLayout",
        "Lay the items out as a vertical stack, a row, or a grid. Columns apply only to a grid.",
        z.strictObject({
          mode: z.enum(["stack", "row", "grid"]),
          columns: z.int().min(1).max(4).optional(),
          align: z.enum(["start", "center", "end", "between"]).optional(),
          explain: explainSchema,
        }),
        ({ mode, columns, align, explain }) => {
          const alignment = align === undefined ? {} : { align }
          if (mode === "grid") {
            return single(
              {
                op: "setLayout",
                target,
                mode,
                ...(columns === undefined ? {} : { columns }),
                ...alignment,
              },
              explain
            )
          }
          return columns === undefined
            ? single({ op: "setLayout", target, mode, ...alignment }, explain)
            : { success: false, error: "columns: Only a grid has columns" }
        }
      )
    )
  }

  return tools
}
