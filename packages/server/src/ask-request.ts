import * as z from "zod"

import {
  addressSchema,
  filterSchema,
  itemIdSchema,
  manifestSchema,
  slotIdSchema,
  sortSchema,
  surfaceSchema,
} from "@pliantui/contract"

const labelSchema = z.string().trim().min(1).max(80)

const itemSchema = z.strictObject({
  id: itemIdSchema,
  label: labelSchema.optional(),
  hidden: z.boolean().optional(),
})

const fieldSchema = z.strictObject({
  id: itemIdSchema,
  label: labelSchema.optional(),
  type: z.enum(["text", "number", "date", "boolean", "enum"]),
  values: z.array(z.string().min(1).max(40)).min(1).max(50).optional(),
})

function hasUniqueIds(list: readonly { id: string }[]) {
  return new Set(list.map(({ id }) => id)).size === list.length
}

/**
 * A compact description of the node the user pointed at: its manifest, the
 * collection its items live in, the dataset fields it can sort and filter by,
 * and its current sort and filters. Never rows.
 *
 * It comes from the client, so the tools it unlocks are only as trustworthy
 * as the client. That is enough for a session preview; anything that saves
 * the overlay must check it against the server's own manifests.
 *
 * @experimental
 */
export const askContextSchema = z
  .strictObject({
    manifest: manifestSchema,
    collection: z
      .strictObject({
        name: z.enum(["columns", "slots"]),
        items: z.array(itemSchema).min(1).max(50),
      })
      .optional(),
    fields: z.array(fieldSchema).min(1).max(50).optional(),
    sort: sortSchema.optional(),
    filters: z.array(filterSchema).max(20).optional(),
  })
  .superRefine((context, ctx) => {
    const { collection, fields } = context
    if (collection && !hasUniqueIds(collection.items)) {
      ctx.addIssue({
        code: "custom",
        path: ["collection", "items"],
        message: "Must have unique ids",
      })
    }
    if (collection?.name === "slots") {
      for (const [index, { id }] of collection.items.entries()) {
        if (!slotIdSchema.safeParse(id).success) {
          ctx.addIssue({
            code: "custom",
            path: ["collection", "items", index, "id"],
            message: "Must be a kebab-case slot id",
          })
        }
      }
    }
    if (fields && !hasUniqueIds(fields)) {
      ctx.addIssue({
        code: "custom",
        path: ["fields"],
        message: "Must have unique ids",
      })
    }
    for (const [index, field] of (fields ?? []).entries()) {
      if ((field.type === "enum") !== (field.values !== undefined)) {
        ctx.addIssue({
          code: "custom",
          path: ["fields", index, "values"],
          message: "Must list values exactly when the type is enum",
        })
      }
    }
  })

/** @experimental */
export type AskContext = z.infer<typeof askContextSchema>

/**
 * The body of an ask: the surface, the address of the node the user pointed
 * at, what they asked for, and the node's context.
 *
 * @experimental
 */
export const askRequestSchema = z.strictObject({
  surface: surfaceSchema,
  target: addressSchema,
  prompt: z.string().trim().min(1).max(500),
  context: askContextSchema,
})

/** @experimental */
export type AskRequest = z.infer<typeof askRequestSchema>
