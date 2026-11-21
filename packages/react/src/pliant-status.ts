/**
 * Whether the surface's layers have loaded from the storage adapter. Until
 * they are `ready`, nothing can change them, and the server render and the
 * first client render resolve no overlays, unless `PliantRoot` was given
 * `layers`.
 *
 * @experimental
 */
export type PliantStatus =
  | { readonly status: "loading" }
  | { readonly status: "ready" }
  | { readonly status: "error"; readonly error: unknown }

export const loadingStatus: PliantStatus = { status: "loading" }
export const readyStatus: PliantStatus = { status: "ready" }
