import type {
  LoadedOverlay,
  ResolvedLayers,
  validateOverlay,
} from "@pliantui/core"

/** What the store lends the planners that change its layers. */
export interface LayerTools {
  readonly surface: string
  readonly generateId: (time: number) => string
  readonly tick: () => number
  /** The UI language to record in new overlays, if known. */
  readonly language: () => string | undefined
  readonly load: (input: unknown) => LoadedOverlay | undefined
  readonly resolve: (inputs: readonly unknown[]) => ResolvedLayers
  /** Validates an overlay of the surface above `overlays`. */
  readonly validateAbove: (
    input: unknown,
    overlays: readonly unknown[]
  ) => ReturnType<typeof validateOverlay>
}
