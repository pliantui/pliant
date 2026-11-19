import type { LoadedOverlay } from "@pliantui/core"

export function idOf(input: unknown) {
  return typeof input === "object" && input !== null && "id" in input
    ? input.id
    : undefined
}

export function mergeById(
  saved: readonly unknown[],
  current: readonly unknown[]
) {
  const ids = new Set(current.map(idOf))
  return [
    ...saved.filter((overlay) => {
      const id = idOf(overlay)
      return id === undefined || !ids.has(id)
    }),
    ...current,
  ]
}

export function withOps(
  { explain, ...overlay }: LoadedOverlay,
  keep: (index: number) => boolean
) {
  const ops = overlay.ops.filter((_, index) => keep(index))
  return {
    ...overlay,
    ops: ops.map((check) => check.op),
    ...(explain ? { explain: explain.filter((_, index) => keep(index)) } : {}),
  }
}
