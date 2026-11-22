"use client"

import * as React from "react"
import { SquareDashedMousePointerIcon } from "lucide-react"
import { Slot } from "radix-ui"
import { createPortal } from "react-dom"

import { usePliantMessages, type PliantMessages } from "@pliantui/react"
import { usePointMode, type PointModeBox } from "@pliantui/react/point-mode"

import { Button } from "@/components/ui/button"

declare module "@pliantui/react" {
  interface PliantMessages {
    pointModeOpen: string
    pointModeLabel: string
    pointModeHelp: string
  }
}

const pointModeMessages = {
  pointModeOpen: "Point",
  pointModeLabel: "Point mode",
  pointModeHelp:
    "Pick a part to change. Use Tab or the arrow keys to move, Enter to pick, Escape to leave.",
} satisfies Partial<PliantMessages>

/** A node users can point at: its id and the label shown on its outline. */
interface PliantPointTarget {
  id: string
  label: string
}

// The outline sits this far outside its target, so it never runs along the
// target's own border, and a label sits this far from any outline.
const gap = 6
// The outline's ring, drawn outside its box.
const ring = 2
// A label's height, and its widest, matching `max-w-48`.
const labelHeight = 20
const labelWidth = 192

interface Rect {
  top: number
  right: number
  bottom: number
  left: number
}

interface Viewport {
  // Where the visible page starts: below a sticky header, when the page
  // declares one with `scroll-padding-top`, as it does for anchor links.
  top: number
  width: number
  height: number
}

// A scrollbar appearing or going changes the viewport's width without a
// `resize` event, so the root element is observed as well.
function subscribeToResize(onResize: () => void) {
  const observer = new ResizeObserver(onResize)
  observer.observe(document.documentElement)
  window.addEventListener("resize", onResize)
  return () => {
    observer.disconnect()
    window.removeEventListener("resize", onResize)
  }
}

// The layout viewport, without scrollbars, kept current as the window resizes.
function useViewportSize() {
  const width = React.useSyncExternalStore(
    subscribeToResize,
    () => document.documentElement.clientWidth,
    () => 0
  )
  const height = React.useSyncExternalStore(
    subscribeToResize,
    () => document.documentElement.clientHeight,
    () => 0
  )
  return { width, height }
}

// A sticky header's height, read from the root's `scroll-padding-top`, which
// a page with one sets so anchor links land below it. Only a length in
// pixels counts.
function headerInset() {
  const value = getComputedStyle(document.documentElement).scrollPaddingTop
  if (!value.endsWith("px")) return 0
  const inset = Number.parseFloat(value)
  return Number.isFinite(inset) ? Math.max(0, inset) : 0
}

// The outline grows `gap` past its target on every side, except where that
// would push its ring off screen.
function outlineOf(box: PointModeBox, viewport: Viewport): Rect {
  const right = box.left + box.width
  const bottom = box.top + box.height
  return {
    top: Math.min(box.top, Math.max(ring, box.top - gap)),
    left: Math.min(box.left, Math.max(ring, box.left - gap)),
    right: Math.max(right, Math.min(viewport.width - ring, right + gap)),
    bottom: Math.max(bottom, Math.min(viewport.height - ring, bottom + gap)),
  }
}

function grow(rect: Rect, by: number): Rect {
  return {
    top: rect.top - by,
    right: rect.right + by,
    bottom: rect.bottom + by,
    left: rect.left - by,
  }
}

function overlaps(a: Rect, b: Rect) {
  return (
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  )
}

function contains(outer: Rect, inner: Rect) {
  return (
    outer.left <= inner.left &&
    inner.right <= outer.right &&
    outer.top <= inner.top &&
    inner.bottom <= outer.bottom
  )
}

const pointModeLayer = '[data-slot="pliant-point-mode"]'

function edgesOf(element: Element, box: DOMRect): Rect[] {
  const style = getComputedStyle(element)
  const visible = (width: string, color: string, lineStyle: string) =>
    Number.parseFloat(width) > 0 &&
    lineStyle !== "none" &&
    lineStyle !== "hidden" &&
    color !== "transparent" &&
    !/^rgba\(.*,\s*0\)$/.test(color) &&
    !/\/\s*0\)$/.test(color)
  const edges: Rect[] = []
  const { top, right, bottom, left } = box
  if (
    visible(style.borderTopWidth, style.borderTopColor, style.borderTopStyle)
  ) {
    edges.push({ top, right, left, bottom: top + 1 })
  }
  if (
    visible(
      style.borderBottomWidth,
      style.borderBottomColor,
      style.borderBottomStyle
    )
  ) {
    edges.push({ top: bottom - 1, right, left, bottom })
  }
  if (
    visible(style.borderLeftWidth, style.borderLeftColor, style.borderLeftStyle)
  ) {
    edges.push({ top, bottom, left, right: left + 1 })
  }
  if (
    visible(
      style.borderRightWidth,
      style.borderRightColor,
      style.borderRightStyle
    )
  ) {
    edges.push({ top, bottom, left: right - 1, right })
  }
  return edges
}

interface PageContent {
  text: Rect[]
  borders: Rect[]
}

function shift(rect: Rect, x: number, y: number): Rect {
  return {
    top: rect.top + y,
    right: rect.right + x,
    bottom: rect.bottom + y,
    left: rect.left + x,
  }
}

// The page's text and borders, which a label would rather not cover, in
// page coordinates so they stay valid as the page scrolls. Hit testing can't
// find them, since the page is `inert` while point mode is a dialog, so this
// walks the page once when point mode starts. Fixed and sticky layers, like
// a site header, move with the screen rather than the page, so they're left
// out.
function findPageContent(): PageContent {
  const content: PageContent = { text: [], borders: [] }
  const range = document.createRange()
  const toPage = (rect: Rect) => shift(rect, window.scrollX, window.scrollY)
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (!(node instanceof Element)) return NodeFilter.FILTER_ACCEPT
        if (node.matches(pointModeLayer)) return NodeFilter.FILTER_REJECT
        const { position } = getComputedStyle(node)
        return position === "fixed" || position === "sticky"
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT
      },
    }
  )
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Element) {
      const box = node.getBoundingClientRect()
      if (box.width > 1 && box.height > 1) {
        content.borders.push(...edgesOf(node, box).map(toPage))
      }
      continue
    }
    if (!node.textContent?.trim()) continue
    const parent = node.parentElement?.getBoundingClientRect()
    // Visually hidden text, like `sr-only`, sits in a 1px box.
    if (!parent || parent.width <= 1 || parent.height <= 1) continue
    range.selectNodeContents(node)
    for (const line of range.getClientRects()) {
      if (line.width > 1 && line.height > 1) content.text.push(toPage(line))
    }
  }
  return content
}

interface Outline {
  box: PointModeBox
  rect: Rect
  // The outlines this one sits inside. Of two with the same rectangle, the
  // later one counts as nested in the earlier.
  parents: ReadonlySet<number>
}

// Whether a label would get in the way of another outline: lie across its
// ring or near it, or sit inside it when the label's own outline isn't
// nested in it, where the label would seem to name the wrong part.
function getsInWay(label: Rect, other: Rect, isParent: boolean) {
  return (
    overlaps(label, grow(other, ring + gap)) &&
    !(isParent && contains(grow(other, -gap), label))
  )
}

// Relative to the outline's box. An end-aligned label is placed by its right
// edge, since it's often narrower than its widest, and never grows wider than
// the room it was placed in.
type LabelPlacement = { top: number; maxWidth: number } & (
  { left: number } | { right: number }
)

interface PlacedLabel {
  placement: LabelPlacement
  rect: Rect
  end: boolean
  // Which of the candidate spots it took, and how much page content it
  // covered there.
  spot: number
  cover: number
}

// A label goes above or below its outline, at either end, or inside the
// outline's top corners, moved down to stay on screen. Of the spots that
// stay on screen and out of the way of every other outline and every label
// placed before it, it takes the first that covers none of the page's text
// and borders, or else the one that covers the least, text counting most.
// When no spot is out of the way, it goes inside the outline's own corner.
// A label keeps the spot it had while the page scrolls, as long as that
// spot still fits and covers no more than it did, so it doesn't hop about.
function placeLabel(
  own: Outline,
  outlines: readonly Outline[],
  placed: readonly Rect[],
  content: PageContent,
  viewport: Viewport,
  previous: PlacedLabel | undefined
): PlacedLabel {
  const { rect: outline, parents } = own
  const inWay = (label: Rect) =>
    outlines.some(
      (other, otherIndex) =>
        other !== own && getsInWay(label, other.rect, parents.has(otherIndex))
    ) || placed.some((other) => overlaps(label, grow(other, gap)))
  const count = (label: Rect, rects: readonly Rect[]) =>
    rects.filter((other) => overlaps(label, other)).length
  // Content is in page coordinates, and is checked against the label's
  // likely width rather than its widest.
  const width = Math.min(labelWidth, own.box.label.length * 7 + 12)
  const covered = (label: Rect, end: boolean) => {
    const likely = shift(
      end
        ? { ...label, left: Math.max(label.left, label.right - width) }
        : { ...label, right: Math.min(label.right, label.left + width) },
      window.scrollX,
      window.scrollY
    )
    return count(likely, content.text) * 1000 + count(likely, content.borders)
  }
  // A label `inset` in from the outline's start or end, clipped to the screen.
  const at = (top: number, end: boolean, inset: number) => {
    const width = Math.max(
      0,
      Math.min(labelWidth, outline.right - outline.left - inset * 2)
    )
    const left = end
      ? Math.min(outline.right, viewport.width) - inset - width
      : Math.max(outline.left, 0) + inset
    const rect = { top, left, right: left + width, bottom: top + labelHeight }
    const placement: LabelPlacement = end
      ? {
          top: top - outline.top,
          maxWidth: width,
          right: outline.right - rect.right,
        }
      : { top: top - outline.top, maxWidth: width, left: left - outline.left }
    return { rect, placement, end }
  }
  const end = own.box.labelAlign === "end"
  const above = outline.top - ring - gap - labelHeight
  const below = outline.bottom + ring + gap
  const fits = (label: Rect) =>
    label.top >= viewport.top &&
    label.bottom <= viewport.height &&
    !inWay(label)
  const outside = [
    at(above, end, 0),
    at(below, end, 0),
    at(above, !end, 0),
    at(below, !end, 0),
  ]
  // Within the part of the outline that's on screen, where there's room.
  const insideTop = Math.max(
    Math.min(
      Math.max(outline.top, viewport.top) + gap,
      Math.min(outline.bottom, viewport.height) - gap - labelHeight
    ),
    outline.top + gap
  )
  const inside = at(insideTop, end, gap)
  const otherCorner = at(insideTop, !end, gap)
  const candidates = [...outside, inside, otherCorner]
  const scored = candidates.map((candidate, spot) => ({
    ...candidate,
    spot,
    cover: fits(candidate.rect)
      ? covered(candidate.rect, candidate.end)
      : Number.POSITIVE_INFINITY,
  }))
  const kept = previous && scored[previous.spot]
  if (kept && Number.isFinite(kept.cover) && kept.cover <= previous.cover) {
    return kept
  }
  let best: PlacedLabel | undefined
  for (const candidate of scored) {
    if (candidate.cover === 0) return candidate
    if (candidate.cover < (best?.cover ?? Number.POSITIVE_INFINITY)) {
      best = candidate
    }
  }
  if (best) return best
  // Nothing fits: the outline's own corner, kept below a sticky header.
  return {
    ...at(Math.max(insideTop, viewport.top), end, gap),
    spot: 4,
    cover: Number.POSITIVE_INFINITY,
  }
}

function layoutOutlines(
  boxes: readonly PointModeBox[],
  viewport: Viewport,
  content: PageContent,
  previous: Map<string, PlacedLabel>
) {
  const shapes = boxes.flatMap((box) => {
    const rect = outlineOf(box, viewport)
    // An outline wholly under a sticky header can't be seen, so it isn't
    // offered.
    return rect.bottom <= viewport.top + ring ? [] : [{ box, rect }]
  })
  const outlines: Outline[] = shapes.map(({ box, rect }, index) => ({
    box,
    rect,
    parents: new Set(
      shapes.flatMap(({ rect: other }, otherIndex) =>
        otherIndex !== index &&
        contains(other, rect) &&
        (!contains(rect, other) || otherIndex < index)
          ? [otherIndex]
          : []
      )
    ),
  }))
  const placed: Rect[] = []
  return outlines.map((own) => {
    const label = placeLabel(
      own,
      outlines,
      placed,
      content,
      viewport,
      previous.get(own.box.id)
    )
    previous.set(own.box.id, label)
    placed.push(label.rect)
    return { box: own.box, outline: own.rect, label: label.placement }
  })
}

/**
 * Point mode: users point at the part of the page they want to change
 * instead of picking it from a list. Hold Alt (Option on a Mac), press ⌘. or
 * Ctrl+., or press the toggle, and the targets on the page are outlined with
 * their labels; clicking one, or moving to it with Tab or the arrow keys and
 * pressing Enter, calls `onPick` with its id. Release Alt, press Escape or
 * click anywhere else to leave without picking. Its behaviour comes from
 * `usePointMode`.
 *
 * A target is found on the page by its `data-pliant-id`, so it must be a
 * Pliant node, like a `PliantRegion`. Point mode ignores Alt and the
 * shortcut while focus is in a text field other than the ask panel's prompt
 * or in a listbox or menu, and while a modal dialog is open or the body has
 * `pointer-events: none`, as Radix sets for its modal layers. Safari keeps
 * ⌘. for Stop, and some Linux desktops move the window on Alt+click, so the
 * toggle is the way in that always works, and the only one on touch screens.
 *
 * Outlines and labels stay below a sticky header when the page sets the
 * root's `scroll-padding-top` to the header's height in pixels, as it would
 * for anchor links. Labels avoid covering the page's text and borders where
 * they can.
 *
 * Started from the toggle or the shortcut, point mode is a modal dialog:
 * the rest of the page, an open ask panel included, is `inert` until it
 * ends, so clicking it leaves point mode. Focus goes back to where it was
 * unless `onPick` moves it, as the ask panel does to its prompt when its
 * target changes.
 */
function PliantPointMode({
  targets,
  onPick,
  trigger,
}: {
  /** The nodes users can point at, usually the ask panel's targets. */
  targets: readonly PliantPointTarget[]
  /** Called with the id of the target the user picked. */
  onPick: (id: string) => void
  /** The element that toggles point mode. Defaults to a `pointModeOpen` button. */
  trigger?: React.ReactElement
}) {
  const messages = usePliantMessages(pointModeMessages)
  const { mode, boxes, announcement, pick, getTriggerProps, getLayerProps } =
    usePointMode({
      targets,
      onPick,
      labelWidth,
    })
  const id = React.useId()
  const { width, height } = useViewportSize()
  // Read once when point mode starts or the window resizes, rather than on
  // every scroll. Each label's spot is remembered for as long as that lasts.
  const page = React.useMemo(
    () =>
      mode === null
        ? null
        : {
            top: headerInset(),
            content: findPageContent(),
            previous: new Map<string, PlacedLabel>(),
          },
    // The size isn't read, but a resize moves the page's content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, width, height]
  )
  const layout = React.useMemo(
    () =>
      page === null
        ? []
        : layoutOutlines(
            boxes,
            { top: page.top, width, height },
            page.content,
            page.previous
          ),
    [page, boxes, width, height]
  )

  return (
    <>
      <Slot.Root {...getTriggerProps()}>
        {trigger ?? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
          >
            <SquareDashedMousePointerIcon />
            {messages.pointModeOpen}
          </Button>
        )}
      </Slot.Root>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
      {mode !== null &&
        createPortal(
          <div
            {...getLayerProps()}
            aria-label={messages.pointModeLabel}
            aria-describedby={mode === "toggle" ? `${id}-help` : undefined}
            className="pointer-events-auto fixed inset-0 z-40 cursor-crosshair"
          >
            {mode === "toggle" && (
              <p id={`${id}-help`} className="sr-only">
                {messages.pointModeHelp}
              </p>
            )}
            {/* Outlines stay below a sticky header, so they never draw
                over it. */}
            <div
              className="absolute inset-0"
              style={{ clipPath: `inset(${String(page?.top ?? 0)}px 0 0 0)` }}
            >
              {layout.map(({ box, outline, label }) => (
                <button
                  key={box.id}
                  type="button"
                  data-pliant-point-target={box.id}
                  className="absolute cursor-pointer rounded-xl bg-primary/5 shadow-lg ring-2 shadow-primary/25 ring-primary/60 outline-none hover:bg-primary/10 hover:shadow-primary/40 hover:ring-primary focus-visible:bg-primary/10 focus-visible:ring-4 focus-visible:shadow-primary/40 focus-visible:ring-primary motion-safe:animate-in motion-safe:transition-[background-color,box-shadow] motion-safe:fade-in-0"
                  style={{
                    top: outline.top,
                    left: outline.left,
                    width: outline.right - outline.left,
                    height: outline.bottom - outline.top,
                  }}
                  onClick={() => {
                    pick(box.id)
                  }}
                >
                  <span
                    className="absolute h-5 max-w-48 truncate rounded-md bg-primary px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-primary-foreground shadow-sm"
                    style={label}
                  >
                    {box.label}
                  </span>
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

export { PliantPointMode, type PliantPointTarget }
