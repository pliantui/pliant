import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import * as z from "zod"

import type { InferredComponent } from "./inferred-component"

const defaultDecisionSchema = z.strictObject({
  class: z.enum(["user", "hidden"]),
  values: z
    .union([z.array(z.string()).min(1), z.array(z.number()).min(1)])
    .optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  persist: z.boolean().optional(),
})

const componentDecisionsSchema = z.strictObject({
  props: z
    .record(
      z.string(),
      z.record(z.string(), z.enum(["user", "semantic", "state", "hidden"]))
    )
    .optional(),
  defaults: z.record(z.string(), defaultDecisionSchema).optional(),
})

export const decisionsSchema = z.strictObject({
  components: z.record(z.string(), componentDecisionsSchema),
})

export type Decisions = z.infer<typeof decisionsSchema>

export async function readDecisions(file: string): Promise<Decisions> {
  if (!existsSync(file)) {
    return { components: {} }
  }
  let raw: unknown
  try {
    raw = JSON.parse(await readFile(file, "utf8"))
  } catch {
    throw new Error(`Could not read ${file}. Check that it is valid JSON.`)
  }
  const result = decisionsSchema.safeParse(raw)
  if (!result.success) {
    throw new Error(
      [
        `${file} isn't a valid decisions file:`,
        ...result.error.issues.map(
          (issue) => `- ${issue.path.join(".")}: ${issue.message}`
        ),
      ].join("\n")
    )
  }
  return result.data
}

export function applyDecisions(
  components: InferredComponent[],
  decisions: Decisions
): InferredComponent[] {
  return components.map((component) => {
    const decided = decisions.components[component.name]
    return {
      ...component,
      props: component.props.map((prop) => ({
        ...prop,
        values: prop.values.map((value) => {
          const decision = decided?.props?.[prop.name]?.[value.value]
          return decision
            ? { ...value, class: decision, decided: true }
            : { ...value }
        }),
      })),
      defaults: component.defaults.map((item) => {
        const decision = decided?.defaults?.[item.name]
        if (!decision) {
          return { ...item }
        }
        const { class: decidedClass, ...details } = decision
        return { ...item, ...details, class: decidedClass, decided: true }
      }),
    }
  })
}

/** Records every value and default of the reviewed components. */
export function recordDecisions(
  previous: Decisions,
  components: InferredComponent[]
): Decisions {
  const result: Decisions = {
    components: { ...previous.components },
  }
  for (const component of components) {
    const props: Record<
      string,
      Record<string, "user" | "semantic" | "state" | "hidden">
    > = {}
    for (const prop of component.props) {
      props[prop.name] = Object.fromEntries(
        prop.values.map((value) => [
          value.value,
          value.class === "confirm" ? "hidden" : value.class,
        ])
      )
    }
    const defaults: NonNullable<Decisions["components"][string]["defaults"]> =
      {}
    for (const item of component.defaults) {
      defaults[item.name] = {
        class: item.class === "user" ? "user" : "hidden",
        ...(item.values ? { values: item.values } : {}),
        ...(item.min === undefined ? {} : { min: item.min }),
        ...(item.max === undefined ? {} : { max: item.max }),
        ...(item.persist ? { persist: true } : {}),
      }
    }
    result.components[component.name] = {
      ...(component.props.length > 0 ? { props } : {}),
      ...(component.defaults.length > 0 ? { defaults } : {}),
    }
  }
  return result
}
