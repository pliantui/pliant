import type { Overlay } from "@pliantui/contract"

export type WithOps<T> = Overlay extends infer O
  ? O extends Overlay
    ? { [K in keyof O as K extends "ops" ? never : K]: O[K] } & { ops: T[] }
    : never
  : never
