import type { ValueClass } from "./classify"

export type PropSource = "cva" | "tv" | "pass-through" | "context" | "union"

export interface InferredValue {
  value: string
  class: ValueClass
  decided: boolean
}

interface InferredProp {
  name: string
  source: PropSource
  boolean: boolean
  /** Components whose context value wins over this prop when it's set. */
  overriddenBy: string[]
  values: InferredValue[]
  default?: string
}

export type DefaultType =
  | { type: "boolean" }
  | { type: "date" }
  | { type: "number" }
  | { type: "string" }
  | { type: "enum"; values: string[] | number[] }

export interface InferredDefault {
  name: string
  declaration: DefaultType
  class: "user" | "confirm" | "hidden"
  decided: boolean
  values?: string[] | number[] | undefined
  min?: number | undefined
  max?: number | undefined
  persist?: boolean | undefined
}

export interface InferredComponent {
  name: string
  file: string
  description: string
  /** False when the variants reaching the component can't be read at all. */
  variantsReadable: boolean
  /** Props whose values can't be read, so they're left out. */
  unreadableProps: string[]
  /** True when the component calls a cva or tv definition. */
  usesVariants: boolean
  /** Whether users may rename and hide it. */
  label: boolean
  hideable: boolean
  props: InferredProp[]
  defaults: InferredDefault[]
}
