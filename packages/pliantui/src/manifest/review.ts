import prompts, { type PromptObject } from "prompts"

import { describeDefaultType } from "./format-summary"
import type {
  InferredComponent,
  InferredDefault,
  InferredValue,
} from "./inferred-component"

class ReviewCancelledError extends Error {}

async function ask(question: Omit<PromptObject<"answer">, "name">) {
  const answers = await prompts(
    { ...question, name: "answer" },
    {
      onCancel: () => {
        throw new ReviewCancelledError()
      },
    }
  )
  const answer: unknown = answers.answer
  return answer
}

async function askBoolean(question: Omit<PromptObject<"answer">, "name">) {
  return (await ask(question)) === true
}

async function askNumber(question: Omit<PromptObject<"answer">, "name">) {
  const answer = await ask(question)
  if (typeof answer !== "number") {
    throw new ReviewCancelledError()
  }
  return answer
}

async function askList(question: Omit<PromptObject<"answer">, "name">) {
  const answer = await ask(question)
  const list: unknown[] = Array.isArray(answer) ? answer : []
  return list
}

async function askIndexes(question: Omit<PromptObject<"answer">, "name">) {
  return (await askList(question)).filter(
    (item): item is number => typeof item === "number"
  )
}

async function askStrings(question: Omit<PromptObject<"answer">, "name">) {
  return (await askList(question)).filter(
    (item): item is string => typeof item === "string"
  )
}

function isNumber(value: unknown) {
  return typeof value === "number" || "Enter a number"
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
    const accept = await askBoolean({
      type: "confirm",
      message: "Accept these classes?",
      initial: true,
    })
    if (!accept) {
      for (const component of reviewed.filter(isUndecided)) {
        await adjustComponent(component)
      }
      await adjustCapabilities(reviewed)
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
  const user = await askIndexes({
    type: "multiselect",
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
      : await askIndexes({
          type: "multiselect",
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

async function adjustCapabilities(components: InferredComponent[]) {
  const choices = (enabled: (component: InferredComponent) => boolean) =>
    components.map((component, index) => ({
      title: component.name,
      value: index,
      selected: enabled(component),
    }))
  const label = await askIndexes({
    type: "multiselect",
    message: "Which components can users rename?",
    instructions: false,
    choices: choices((component) => component.label),
  })
  const hideable = await askIndexes({
    type: "multiselect",
    message: "Which components can users hide?",
    instructions: false,
    choices: choices((component) => component.hideable),
  })
  for (const [index, component] of components.entries()) {
    component.label = label.includes(index)
    component.hideable = hideable.includes(index)
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

  const selected = await askIndexes({
    type: "multiselect",
    message: "These need your confirmation. Which can users set?",
    instructions: false,
    choices: pending.map((entry, index) => ({
      title: entry.label,
      value: index,
    })),
  })

  const kept: { label: string; item: InferredDefault }[] = []
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
      const values = await askStrings({
        type: "list",
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
      entry.item.min = await askNumber({
        type: "number",
        message: `${entry.label}: smallest value users can choose?`,
        float: true,
        validate: isNumber,
      })
      entry.item.max = await askNumber({
        type: "number",
        message: `${entry.label}: largest value users can choose?`,
        float: true,
        validate: isNumber,
        min: entry.item.min,
      })
    }
    kept.push({ label: entry.label, item: entry.item })
  }

  if (kept.length === 0) {
    return
  }
  const persist = await askIndexes({
    type: "multiselect",
    message: "Which of these should save users' own changes automatically?",
    instructions: false,
    choices: kept.map((entry, index) => ({ title: entry.label, value: index })),
  })
  for (const [index, entry] of kept.entries()) {
    if (persist.includes(index)) {
      entry.item.persist = true
    }
  }
}
