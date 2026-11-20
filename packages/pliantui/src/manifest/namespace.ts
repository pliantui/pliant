import * as z from "zod"

export const defaultNamespace = "app"

// Generated kinds are namespaced, because bare kinds are reserved for
// Pliant's built-in components.
export const namespaceSchema = z
  .string()
  .max(32)
  .regex(
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/,
    "Must be kebab-case and start with a letter, for example acme"
  )
  .refine(
    (namespace) => namespace !== "pliant",
    "The pliant namespace is reserved for Pliant's built-in components"
  )
