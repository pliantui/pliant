import { useEffect } from "react"

/** @experimental */
export interface PliantPrePaintProps {
  /** The surface of the `PliantRoot` whose overlays the script reads. */
  readonly surface: string
  /**
   * The nonce of the page's Content Security Policy. The script carries it,
   * and gives it to the `<style>` it adds.
   */
  readonly nonce?: string | undefined
  /**
   * How long, in milliseconds, a skeleton can last before the content shows
   * anyway, whether or not the layers have loaded. It keeps content visible
   * when hydration or loading fails. Defaults to 4500, well past the time a
   * slow connection takes to load the layers.
   */
  readonly revealAfter?: number | undefined
}

// Runs as an inline script, from its source text, so it uses nothing from
// outside its own body.
function prePaint(surface: string, revealAfter: string) {
  const ids: string[] = []
  function field(value: unknown, key: string): unknown {
    return typeof value === "object" && value !== null && key in value
      ? (value as Record<string, unknown>)[key]
      : undefined
  }
  function list(value: unknown): readonly unknown[] {
    return Array.isArray(value) ? (value as unknown[]) : []
  }
  function add(address: unknown) {
    const id =
      typeof address === "string" &&
      /^([a-z][a-z0-9]*(?:-[a-z0-9]+)*)(?:\[\])?(?:\/|$)/.exec(address)?.[1]
    if (id && !ids.includes(id)) {
      ids.push(id)
    }
  }
  function read(
    text: string | null,
    overlaysOf: (value: unknown) => unknown[]
  ) {
    let value: unknown
    try {
      value = JSON.parse(text ?? "null")
    } catch {
      // An entry that isn't JSON doesn't load, so it changes nothing.
      return
    }
    for (const overlay of overlaysOf(value)) {
      for (const op of list(field(overlay, "ops"))) {
        add(field(op, "target"))
        add(field(field(op, "to"), "into"))
      }
    }
  }
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index) ?? ""
      const prefix = [`pliant:${surface}:`, "pliant:@app:"].find((start) =>
        key.startsWith(start)
      )
      if (prefix && !key.includes(":", prefix.length)) {
        read(localStorage.getItem(key), (record) =>
          field(record, "deletedAt") ? [] : [field(record, "overlay")]
        )
      }
    }
    read(sessionStorage.getItem(`pliant:session:${surface}`), (session) => {
      return field(session, "v") === 1
        ? [...list(field(session, "overlays")), field(session, "preview")]
        : []
    })
  } catch {
    // Storage is blocked, so no overlays load either.
  }
  if (ids.length > 0) {
    const nodes = `:is(${ids
      .map((id) => `[data-pliant-id="${id}"]`)
      .join()})[data-pliant-pending]`
    const style = document.createElement("style")
    const script = document.currentScript
    const end = `0s ${revealAfter}ms forwards`
    // An empty nonce is no nonce, so `||` is the intent.
    /* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
    style.nonce = script?.nonce || script?.getAttribute("nonce") || ""
    /* eslint-enable @typescript-eslint/prefer-nullish-coalescing */
    style.id = "pliant-pre-paint"
    style.textContent = `${nodes}{border-radius:var(--radius,.5rem);background:color-mix(in srgb,currentColor 8%,transparent);animation:pliant-pre-paint 2s ease-in-out infinite,pliant-tint ${end}}${nodes}>*{visibility:hidden;animation:pliant-reveal ${end}}@keyframes pliant-pre-paint{50%{opacity:.5}}@keyframes pliant-tint{to{opacity:1;background:none}}@keyframes pliant-reveal{to{visibility:visible}}@media (prefers-reduced-motion:reduce){${nodes}{animation-duration:0s}}`
    document.head.appendChild(style)
  }
}

/**
 * An inline script that keeps the first paint from showing a layout the
 * user's overlays are about to change. Before the page paints, it reads the
 * overlays `localAdapter` stored for `surface` and for `@app`, and the
 * session layer, and adds a `<style>` to the document head. While the
 * layers load, the style shows a skeleton in place of each node an op
 * targets: the element with that node's `data-pliant-id` and
 * `data-pliant-pending` (see `usePliantNodeProps`), such as a
 * `PliantRegion`. Every other node, and every node of a user with no
 * overlays, renders as usual. The skeleton ends as the layers apply, before
 * the next paint, and after `revealAfter` at the latest, so content stays
 * visible if hydration or loading fails.
 *
 * The skeleton covers node and region ops: order, visibility, and layout.
 * Preference ops on `@surface` and `@app`, such as density, text scale, and
 * motion, still apply after hydration.
 *
 * The style matches nodes by id alone. Once no node is pending, the
 * component removes it, so a node of the same id on another surface, or one
 * that mounts later, doesn't show a skeleton. Until then, such a node shows
 * one while its layers load, up to `revealAfter`.
 *
 * Render it in the document before the surface's nodes, such as in the
 * layout's `<head>` or first inside `PliantRoot`. The script runs only when
 * the browser parses the page: after a client-side navigation, the layers
 * load before the first paint anyway. With a Content Security Policy, pass
 * its nonce.
 *
 * @experimental
 */
export function PliantPrePaint({
  surface,
  nonce,
  revealAfter = 4500,
}: PliantPrePaintProps) {
  useEffect(() => {
    const retire = () => {
      if (!document.querySelector("[data-pliant-pending]")) {
        document.getElementById("pliant-pre-paint")?.remove()
        observer.disconnect()
      }
    }
    const observer = new MutationObserver(retire)
    observer.observe(document, {
      attributes: true,
      subtree: true,
    })
    retire()
    return () => {
      observer.disconnect()
    }
  }, [])
  return (
    <script
      // React runs no script it renders in the browser, and warns about
      // one, so the browser renders it inert: the server's copy has run.
      type={typeof window === "undefined" ? undefined : "text/plain"}
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: `(${prePaint.toString()})(${JSON.stringify(surface).replace(/</g, "\\u003c")},"${String(revealAfter | 0)}")`,
      }}
    />
  )
}
