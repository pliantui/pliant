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
function useViewport(): Viewport {
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

// A label goes above its outline, or below it, wherever it stays on screen
// and out of the way of every other outline and every label placed before
// it. When neither fits, it goes inside the outline's top corner, moved
// down to stay on screen, and at the other corner if the first one is in
// the way.
function placeLabel(
  own: Outline,
  outlines: readonly Outline[],
  placed: readonly Rect[],
  viewport: Viewport
): { placement: LabelPlacement; rect: Rect } {
  const { rect: outline, parents } = own
  const inWay = (label: Rect) =>
    outlines.some(
      (other, otherIndex) =>
        other !== own && getsInWay(label, other.rect, parents.has(otherIndex))
    ) || placed.some((other) => overlaps(label, grow(other, gap)))
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
    return { rect, placement }
  }
  const end = own.box.labelAlign === "end"
  for (const top of [
    outline.top - ring - gap - labelHeight,
    outline.bottom + ring + gap,
  ]) {
    const outside = at(top, end, 0)
    const onScreen = top >= 0 && outside.rect.bottom <= viewport.height
    if (onScreen && !inWay(outside.rect)) {
      return outside
    }
  }
  // Within the part of the outline that's on screen, where there's room.
  const insideTop = Math.max(
    Math.min(
      Math.max(outline.top, 0) + gap,
      Math.min(outline.bottom, viewport.height) - gap - labelHeight
    ),
    outline.top + gap
  )
  const inside = at(insideTop, end, gap)
  if (!inWay(inside.rect)) {
    return inside
  }
  const otherCorner = at(insideTop, !end, gap)
  return inWay(otherCorner.rect) ? inside : otherCorner
}

function layoutOutlines(boxes: readonly PointModeBox[], viewport: Viewport) {
  const shapes = boxes.map((box) => ({ box, rect: outlineOf(box, viewport) }))
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
    const { placement, rect } = placeLabel(own, outlines, placed, viewport)
    placed.push(rect)
    return { box: own.box, outline: own.rect, label: placement }
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
  const viewport = useViewport()

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
            {layoutOutlines(boxes, viewport).map(({ box, outline, label }) => (
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
          </div>,
          document.body
        )}
    </>
  )
}

export { PliantPointMode, type PliantPointTarget }
