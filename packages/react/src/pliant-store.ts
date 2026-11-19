import type { Op } from "@pliantui/contract"
import type { ValidatedOverlay } from "@pliantui/core"

/**
 * The overlay a change made, or why it was rejected, as `formatError`
 * formats it.
 *
 * @experimental
 */
export type OverlayResult =
  | { readonly success: true; readonly overlay: ValidatedOverlay }
  | { readonly success: false; readonly error: string }

/**
 * What `lockIn` saved: the personal version, or `null` when no op could be
 * saved there, and the ops kept in the session layer instead.
 *
 * @experimental
 */
export type LockInResult =
  | {
      readonly success: true
      readonly overlay: ValidatedOverlay | null
      readonly keptInSession: readonly Op[]
    }
  | { readonly success: false; readonly error: string }

/** @experimental */
export interface ApplyOpsOptions {
  /** One short sentence per op, shown in history. */
  readonly explain?: readonly string[] | undefined
}

/**
 * Changes the layers of the surface that the nearest `PliantRoot` holds.
 *
 * Each tab holds its own copy of the layers: another tab's changes show
 * after a reload.
 *
 * @experimental
 */
export interface PliantStore {
  /**
   * Applies ops as one overlay on the personal or session layer, made with
   * `source: "manual"`, `createdBy: "local"` and `basis.manifests: {}`,
   * because the manifest versions aren't known here. `lang` is
   * `PliantRoot`'s `lang` prop, else the page's `<html lang>` when it is a
   * well-formed language tag, and is left out otherwise.
   *
   * `createdAt` always sorts after every loaded personal and session
   * overlay. So a saved overlay dated in the future, from a clock that ran
   * ahead, moves every later `createdAt` past its date for good.
   *
   * The overlay is validated against the layers below it and the mounted
   * nodes, and rejected as a whole when any op is invalid. It is also
   * rejected until the layers are `ready` (see `usePliantStatus`), rather
   * than validated against layers that haven't loaded.
   *
   * A personal change that writes exactly the properties of the previous
   * one, within 1s of it, replaces it, so dragging a column width saves one
   * version. Changes that place, insert or remove an item (such as `move`,
   * `pin` or `remove`) are never replaced, since resolution keeps their
   * history. Personal changes are saved after 1s without another one, and
   * when the page is hidden or unloads. A session change replaces the
   * session overlay that wrote exactly the same properties, with the same
   * exception.
   */
  readonly applyOps: (
    layer: "personal" | "session",
    ops: readonly Op[],
    options?: ApplyOpsOptions
  ) => OverlayResult
  /**
   * Shows a session overlay, such as an AI answer, on top of every layer
   * until `lockIn` or `discard`. It replaces the current preview, which
   * ends as on `discard`, keeping the changes made while it showed.
   */
  readonly preview: (overlay: unknown) => OverlayResult
  /**
   * Ends the preview by keeping it: its ops become a new personal version,
   * saved at once. Session changes to the same whole-value properties
   * (such as `visible`, `width` or `sort`) are dropped, so they can't hide
   * it.
   *
   * Some ops stay in the session layer instead, as a new session overlay
   * above the others, and are listed in `keptInSession`:
   * - ops allowed only in the session layer, such as `setPage`;
   * - ops that share a property with a session placement, insertion or
   *   removal, which are never dropped, since resolution keeps their history
   *   (later anchors on a moved item still use its old place);
   * - ops that don't validate as a personal version;
   * - every op, when the rest wouldn't validate above the locked version;
   * - ops whose move would change the resolved view (each property's
   *   winning op, each placement, and each op that doesn't apply), such as a
   *   move into a node a session `wrap` creates;
   * - with each of these, every op that shares a property with it.
   *
   * The resolved view is the same before and after. `overlay` is `null` when
   * every op stays in the session layer.
   *
   * Changes made to the session layer while the preview showed (a click on
   * a column the preview sorts, say) end up as on `discard`, above the
   * locked version, so the user's latest choice keeps winning. When they
   * can't keep rendering as they did (a removal that applied only in the
   * preview's layer, say), nothing changes and the result says why.
   */
  readonly lockIn: () => LockInResult
  /**
   * Drops the preview. Changes made to the session layer while it showed
   * are kept: those the personal layer accepts become a personal version
   * above the others, saved at once, replacing the earlier session changes
   * to the same whole-value properties; the rest stay in the session layer,
   * above every other session change. What renders is what the same changes
   * render without the preview. A change that would render differently as
   * a personal version (a move while a session move is in the history,
   * say) stays in the session layer, and when none can move, every change
   * stays where it was. Changes made while the preview showed are the
   * session overlays dated after it, so they are found after a reload too.
   */
  readonly discard: () => void
  /** Loads the layers from the storage adapter again, as after an error. */
  readonly reload: () => void
}
