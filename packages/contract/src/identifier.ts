import * as z from "zod"

const kebab = "[a-z][a-z0-9]*(?:-[a-z0-9]+)*"
const item = "[A-Za-z][A-Za-z0-9_-]*"

export const idPatterns = { kebab, item } as const

export const kebabIdSchema = z
  .string()
  .max(64)
  .regex(new RegExp(`^${kebab}$`), "Must be kebab-case and start with a letter")

export const itemIdSchema = z
  .string()
  .max(64)
  .regex(
    new RegExp(`^${item}$`),
    "Must start with a letter and contain only letters, digits, - and _"
  )

export const propNameSchema = z
  .string()
  .max(64)
  .regex(/^[a-z][A-Za-z0-9]*$/, "Must be camelCase")

function notReserved<T extends z.ZodString>(schema: T) {
  return schema
    .refine(
      (name) => !name.startsWith("pliant:"),
      "The pliant: namespace is reserved for built-ins"
    )
    .meta({ not: { pattern: "^pliant:" } })
}

export const registeredNameSchema = notReserved(
  z
    .string()
    .max(64)
    .regex(new RegExp(`^${kebab}:${kebab}$`), {
      message: "Must be namespace:name, for example acme:rating",
      abort: true,
    })
)

export const kindSchema = notReserved(
  z
    .string()
    .max(64)
    .regex(new RegExp(`^(?:${kebab}:)?${kebab}$`), {
      message:
        "Must be kebab-case, optionally namespaced, for example acme:rating",
      abort: true,
    })
)

export const functionNameSchema = notReserved(
  z
    .string()
    .max(64)
    .regex(new RegExp(`^(?:${kebab}:)?[a-z][A-Za-z0-9]*$`), {
      message: "Must be a built-in function name or namespace:name",
      abort: true,
    })
)
