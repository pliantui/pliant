import prompts, { type PromptObject } from "prompts"

import { describeDefaultType } from "./format-summary"
import type {
  InferredComponent,
  InferredDefault,
  InferredValue,
} from "./inferred-component"

class ReviewCancelledError extends Error {}

async function ask<T>(question: PromptObject): Promise<T> {
  const answers = await prompts(question, {
    onCancel: () => {
      throw new ReviewCancelledError()
    },
  })
  return answers[question.name as string] as T
}

function isUndecided(component: InferredComponent) {
  return (
    component.props.some((prop) =>
      prop.values.some((value) => !value.decided)
    ) || component.defaults.some((item) => !item.decided)
  )
}

export function hasUndecided(components: InferredComponent[]) {
  return components.some(isUndecided)
}

/**
 * Lets the developer accept the inferred classes or change them, then asks
 * about everything that needs confirmation. Returns undefined when the
 * developer cancels.
 */
export async function reviewComponents(
  components: InferredComponent[]
): Promise<InferredComponent[] | undefined> {
  const reviewed = structuredClone(components)
  try {
    const accept = await ask<boolean>({
      type: "confirm",
      name: "accept",
      message: "Accept these classes?",
      initial: true,
    })
    if (!accept) {
      for (const component of reviewed.filter(isUndecided)) {
        await adjustComponent(component)
      }
    }
    await confirmPending(reviewed)
  } catch (error) {
    if (error instanceof ReviewCancelledError) {
      return undefined
    }
    throw error
  }
  return reviewed
}

async function adjustComponent(component: InferredComponent) {
  const entries = component.props.flatMap((prop) =>
    prop.values.map((value) => ({
      label: `${prop.name}: ${value.value}`,
      value,
    }))
  )
  if (entries.length === 0) {
    return
  }
  const user = await ask<number[]>({
    type: "multiselect",
    name: "user",
    message: `${component.name}: which values can users set?`,
    instructions: false,
    choices: entries.map((entry, index) => ({
      title: entry.label,
      value: index,
      selected: entry.value.class === "user",
    })),
  })
  const rest = entries
    .map((entry, index) => ({ ...entry, index }))
    .filter((entry) => !user.includes(entry.index))
  const semantic =
    rest.length === 0
      ? []
      : await ask<number[]>({
          type: "multiselect",
          name: "semantic",
          message: `${component.name}: which of the others should users see but not set?`,
          instructions: false,
          choices: rest.map((entry) => ({
            title: entry.label,
            value: entry.index,
            selected: entry.value.class === "semantic",
          })),
        })
  for (const [index, entry] of entries.entries()) {
    entry.value.class = user.includes(index)
      ? "user"
      : semantic.includes(index)
        ? "semantic"
        : entry.value.class === "state"
          ? "state"
          : "hidden"
  }
}

type Pending =
  | { label: string; value: InferredValue }
  | { label: string; item: InferredDefault }

async function confirmPending(components: InferredComponent[]) {
  const pending: Pending[] = components.flatMap((component) => [
    ...component.props.flatMap((prop) =>
      prop.values
        .filter((value) => value.class === "confirm")
        .map((value) => ({
          label: `${component.name} ${prop.name}: ${value.value}`,
          value,
        }))
    ),
    ...component.defaults
      .filter((item) => item.class === "confirm")
      .map((item) => ({
        label: `${component.name} ${item.name} (${describeDefaultType(item.declaration)})`,
        item,
      })),
  ])
  if (pending.length === 0) {
    return
  }

  const selected = await ask<number[]>({
    type: "multiselect",
    name: "selected",
    message: "These need your confirmation. Which can users set?",
    instructions: false,
    choices: pending.map((entry, index) => ({
      title: entry.label,
      value: index,
    })),
  })

  const kept: Pending[] = []
  for (const [index, entry] of pending.entries()) {
    const isSelected = selected.includes(index)
    if ("value" in entry) {
      entry.value.class = isSelected ? "user" : "hidden"
      continue
    }
    entry.item.class = isSelected ? "user" : "hidden"
    if (!isSelected) {
      continue
    }
    if (entry.item.declaration.type === "string") {
      const values = await ask<string[]>({
        type: "list",
        name: "values",
        message: `${entry.label}: which values can users choose? (comma-separated)`,
        separator: ",",
      })
      const cleaned = [...new Set(values.map((value) => value.trim()))].filter(
        Boolean
      )
      if (cleaned.length === 0) {
        entry.item.class = "hidden"
        continue
      }
      entry.item.values = cleaned
    } else if (entry.item.declaration.type === "number") {
      entry.item.min = await ask<number>({
        type: "number",
        name: "min",
        message: `${entry.label}: smallest value users can choose?`,
        float: true,
      })
      entry.item.max = await ask<number>({
        type: "number",
        name: "max",
        message: `${entry.label}: largest value users can choose?`,
        float: true,
        min: entry.item.min,
      })
    }
    kept.push(entry)
  }

  if (kept.length === 0) {
    return
  }
  const persist = await ask<number[]>({
    type: "multiselect",
    name: "persist",
    message: "Which of these should save users' own changes automatically?",
    instructions: false,
    choices: kept.map((entry, index) => ({ title: entry.label, value: index })),
  })
  for (const [index, entry] of kept.entries()) {
    if ("item" in entry && persist.includes(index)) {
      entry.item.persist = true
    }
  }
}
