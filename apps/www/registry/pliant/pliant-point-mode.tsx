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

// The outline grows `gap` past its target on every side, except where that
// would push its ring off screen.
function outlineOf(box: PointModeBox): Rect {
  const right = box.left + box.width
  const bottom = box.top + box.height
  const viewportWidth = document.documentElement.clientWidth
  const viewportHeight = document.documentElement.clientHeight
  return {
    top: Math.min(box.top, Math.max(ring, box.top - gap)),
    left: Math.min(box.left, Math.max(ring, box.left - gap)),
    right: Math.max(right, Math.min(viewportWidth - ring, right + gap)),
    bottom: Math.max(bottom, Math.min(viewportHeight - ring, bottom + gap)),
  }
}

function contains(outer: Rect, inner: Rect) {
  return (
    outer.left <= inner.left &&
    inner.right <= outer.right &&
    outer.top <= inner.top &&
    inner.bottom <= outer.bottom
  )
}

// Whether a label for `own` would get in the way of another outline: lie
// across its ring or near it, or sit inside it when `own` isn't nested in it,
// where the label would seem to name the wrong part.
function getsInWay(label: Rect, own: Rect, other: Rect) {
  const reach = {
    top: other.top - ring - gap,
    right: other.right + ring + gap,
    bottom: other.bottom + ring + gap,
    left: other.left - ring - gap,
  }
  const overlaps =
    label.left < reach.right &&
    reach.left < label.right &&
    label.top < reach.bottom &&
    reach.top < label.bottom
  const inside = {
    top: other.top + gap,
    right: other.right - gap,
    bottom: other.bottom - gap,
    left: other.left + gap,
  }
  return overlaps && !(contains(other, own) && contains(inside, label))
}

// Relative to the outline's box. An end-aligned label is placed by its right
// edge, since it's often narrower than its widest.
type LabelPlacement = { top: number } & ({ left: number } | { right: number })

// A label goes above its outline, or below it, wherever it stays on screen
// and out of every other outline's way. When neither fits, it goes
// inside the outline's top corner.
function placeLabel(
  outline: Rect,
  others: readonly Rect[],
  align: PointModeBox["labelAlign"]
): LabelPlacement {
  const viewportWidth = document.documentElement.clientWidth
  const viewportHeight = document.documentElement.clientHeight
  const width = Math.min(labelWidth, outline.right - outline.left)
  const right = Math.min(outline.right, viewportWidth)
  const left = align === "end" ? right - width : Math.max(outline.left, 0)
  const across =
    align === "end"
      ? { right: outline.right - right }
      : { left: left - outline.left }
  const outside = [
    outline.top - ring - gap - labelHeight,
    outline.bottom + ring + gap,
  ]
  for (const top of outside) {
    const label = { top, left, right: left + width, bottom: top + labelHeight }
    const onScreen = top >= 0 && label.bottom <= viewportHeight
    if (onScreen && !others.some((other) => getsInWay(label, outline, other))) {
      return { top: top - outline.top, ...across }
    }
  }
  return align === "end" ? { top: gap, right: gap } : { top: gap, left: gap }
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
            {boxes.map((box) => {
              const outline = outlineOf(box)
              const label = placeLabel(
                outline,
                boxes.filter((other) => other.id !== box.id).map(outlineOf),
                box.labelAlign
              )
              return (
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
              )
            })}
          </div>,
          document.body
        )}
    </>
  )
}

export { PliantPointMode, type PliantPointTarget }
