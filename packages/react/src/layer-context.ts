import type {
  LoadedOverlay,
  ResolvedLayers,
  validateOverlay,
} from "@pliantui/core"

/** What the store lends the code that plans a change to its layers. */
export interface LayerContext {
  readonly surface: string
  readonly generateId: (time: number) => string
  readonly tick: () => number
  readonly load: (input: unknown) => LoadedOverlay | undefined
  readonly resolve: (inputs: readonly unknown[]) => ResolvedLayers
  /** Validates an overlay of the surface above `overlays`. */
  readonly validateAbove: (
    input: unknown,
    overlays: readonly unknown[]
  ) => ReturnType<typeof validateOverlay>
}
