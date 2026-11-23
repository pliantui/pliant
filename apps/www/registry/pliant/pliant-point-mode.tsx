"use client"

import * as React from "react"
import {
  EyeOffIcon,
  GripVerticalIcon,
  MoveHorizontalIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
} from "lucide-react"
import { Slot } from "radix-ui"
import { createPortal } from "react-dom"

import type { Op } from "@pliantui/contract"
import {
  usePliantMessages,
  usePliantStore,
  type PliantMessages,
} from "@pliantui/react"
import { usePointMode, type PointModeBox } from "@pliantui/react/point-mode"

import { Button } from "@/components/ui/button"

import {
  handlesOf,
  moveOp,
  partsOf,
  spanOp,
  type PliantPointFlags,
  type PliantPointTarget,
  type PointPart,
} from "./pliant-point-mode-selection"

declare module "@pliantui/react" {
  interface PliantMessages {
    pointModeLabel: string
    pointModeHelp: string
    pointModeSelected: (label: string) => string
    pointModeMove: (label: string) => string
    pointModeResize: (label: string) => string
    pointModeHide: (label: string) => string
    pointModeMoved: (label: string, position: number, count: number) => string
    pointModeResized: (label: string, columns: number) => string
    pointModeHidden: (label: string) => string
    pointModeReset: (label: string) => string
    pointModeFailed: (label: string) => string
    pointModeBar: (label: string) => string
    pointModeAsk: string
    pointModeAdjust: string
    pointModeResetAction: string
  }
}

const pointModeMessages = {
  pointModeLabel: "Point mode",
  pointModeHelp:
    "Select a part to change. Use Tab or the arrow keys to move between parts, Enter to select, Escape to leave. With a part selected, the arrow keys move it, Shift with the arrow keys resizes it, and Delete hides it.",
  pointModeSelected: (label) => `${label} selected.`,
  pointModeMove: (label) => `Move ${label}`,
  pointModeResize: (label) => `Resize ${label}`,
  pointModeHide: (label) => `Hide ${label}`,
  pointModeMoved: (label, position, count) =>
    `Moved ${label} to position ${String(position)} of ${String(count)}.`,
  pointModeResized: (label, columns) =>
    `${label} spans ${String(columns)} ${columns === 1 ? "column" : "columns"}.`,
  pointModeHidden: (label) => `Hid ${label}. Reset brings it back.`,
  pointModeReset: (label) => `Reset ${label}.`,
  pointModeFailed: (label) => `Couldn't change ${label}.`,
  pointModeBar: (label) => `Change ${label}`,
  pointModeAsk: "Ask",
  pointModeAdjust: "Adjust",
  pointModeResetAction: "Reset",
} satisfies Partial<PliantMessages>

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
  previous: ReadonlyMap<string, PlacedLabel>
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
    placed.push(label.rect)
    return {
      box: own.box,
      outline: own.rect,
      label: label.placement,
      placed: label,
    }
  })
}

/**
 * What the selection bar runs for a target, usually the same handlers as the
 * target's Customize menu. An action without a handler is disabled, and
 * shows `unavailable` after its name.
 */
interface PliantPointActions {
  onAsk?: (() => void) | undefined
  onAdjust?: (() => void) | undefined
  onReset?: (() => void) | undefined
  canReset?: boolean | undefined
  unavailable?: React.ReactNode
}

/** Starts point mode from elsewhere, such as a Customize menu. */
interface PliantPointModeHandle {
  /** Turns point mode on, with `target` selected when it's given. */
  start: (target?: string) => void
}

interface Drag {
  kind: "move" | "resize"
  x: number
  y: number
  dx: number
  dy: number
}

function elementOf(id: string) {
  return document.querySelector(`[data-pliant-id="${CSS.escape(id)}"]`)
}

// The columns of the grid a region lays its slots out in, and the gap
// between them, or one column when it isn't a grid.
function gridOf(region: string) {
  const element = elementOf(region)
  if (!element) return { columns: 1, gap: 0, width: 0 }
  const style = getComputedStyle(element)
  return style.display === "grid"
    ? {
        columns: style.gridTemplateColumns.split(" ").filter(Boolean).length,
        gap: Number.parseFloat(style.columnGap) || 0,
        width: element.getBoundingClientRect().width,
      }
    : { columns: 1, gap: 0, width: 0 }
}

// How many columns a slot spans: its wrapper has no box, so it's read from
// the slot's first element.
function spanOf(id: string, columns: number) {
  const end = elementOf(id)?.firstElementChild
  const value = end ? getComputedStyle(end).gridColumnEnd : "auto"
  const match = /^span (\d+)$/.exec(value)
  if (value === "-1") return columns
  return match ? Number(match[1]) : 1
}

// Scrolls a selected part into view, as one picked from a Customize menu
// below the fold, so its handles and bar are on screen.
function reveal(id: string) {
  const element = elementOf(id)
  const nodes =
    element && getComputedStyle(element).display === "contents"
      ? element.firstElementChild
      : element
  nodes?.scrollIntoView({ block: "nearest" })
}

function siblingsOf(part: PointPart, shown: ReadonlySet<string>) {
  const region = elementOf(part.parent)
  return region
    ? [...region.querySelectorAll(":scope > [data-pliant-id]")].flatMap(
        (element) => {
          const id = element.getAttribute("data-pliant-id")
          return id !== null && shown.has(id) ? [id] : []
        }
      )
    : []
}

/**
 * Point mode, a selection mode: users select the part of the page they want
 * to change instead of picking it from a list. Hold Alt (Option on a Mac),
 * call `start` on its `ref`, as a Customize menu's Adjust by hand does, or
 * press the `trigger`, and the targets on the page are outlined with their
 * labels, along with the slots of each target that has a `slots`
 * collection. Clicking or tapping an outline, or moving to it with Tab or
 * the arrow keys and pressing Enter, selects it.
 *
 * A selected slot shows handles to drag it among its siblings (`move`),
 * resize it across a grid's columns (`span`) and hide it (`hide`), each
 * saved for the user at once, as a change made by hand. A handle shows only
 * when its region's manifest allows it (`slots`, `layout` and `hideable`)
 * and the slot's `flags` don't forbid it: `required` hides the hide handle,
 * and `locked` hides them all. With a slot selected, the arrow keys move
 * it, Shift with the arrow keys resizes it, and Delete or Backspace hides
 * it. Each change is announced. A bar under the selection runs `actions`
 * for the selected target, or the slot's target: Ask, Adjust and Reset.
 * Ask and Adjust end point mode first, so their handlers can move focus.
 *
 * Release Alt without selecting, press Escape or click outside the outlines
 * to leave. Started from `start` or the trigger, or once something is
 * selected, point mode is a modal dialog: the rest of the page is `inert`
 * until it ends, and focus then goes back to where it was unless an action
 * moves it. Its behaviour comes from `usePointMode`.
 *
 * A target is found on the page by its `data-pliant-id`, so it must be a
 * Pliant node, like a `PliantRegion`. Point mode ignores Alt while focus is
 * in a text field other than the ask panel's prompt or in a listbox or
 * menu, and while a modal dialog is open or the body has `pointer-events:
 * none`, as Radix sets for its modal layers. Outlines and labels stay below
 * a sticky header when the page sets the root's `scroll-padding-top` to the
 * header's height in pixels, and labels avoid covering the page's text and
 * borders where they can.
 */
function PliantPointMode({
  targets,
  actions,
  flags = {},
  trigger,
  ref,
}: {
  /** The nodes users can point at, usually the ask panel's targets. */
  targets: readonly PliantPointTarget[]
  /** What the selection bar runs for a target, by its id. */
  actions?: ((target: string) => PliantPointActions | undefined) | undefined
  /** What each slot's flags forbid, by its address. */
  flags?: PliantPointFlags | undefined
  /** An element that turns point mode on and off. By default there's none. */
  trigger?: React.ReactElement | undefined
  ref?: React.Ref<PliantPointModeHandle> | undefined
}) {
  const messages = usePliantMessages(pointModeMessages)
  const store = usePliantStore()
  const parts = React.useMemo(() => partsOf(targets), [targets])
  const outlined = React.useMemo(
    () => [
      ...targets.map(({ id, label }) => ({ id, label })),
      ...parts.map(({ id, label }) => ({ id, label })),
    ],
    [targets, parts]
  )
  const {
    mode,
    boxes,
    announcement,
    start,
    exit,
    getTriggerProps,
    getLayerProps,
  } = usePointMode({ targets: outlined, labelWidth })
  const [selected, setSelected] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState("")
  const [drag, setDrag] = React.useState<Drag | null>(null)
  // Focus to restore once the outlines are laid out again, as after a move
  // reorders them.
  const focusAfter = React.useRef<string | null>(null)
  // An action to run once point mode has ended and the page isn't inert.
  const afterExit = React.useRef<(() => void) | null>(null)
  const id = React.useId()
  const { width, height } = useViewportSize()
  const page = React.useMemo(
    () =>
      mode === null
        ? null
        : {
            top: headerInset(),
            content: findPageContent(),
          },
    // The size isn't read, but a resize moves the page's content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, width, height]
  )
  const previous = React.useRef<{
    page: typeof page
    labels: ReadonlyMap<string, PlacedLabel>
  }>({ page: null, labels: new Map() })
  const layout = React.useMemo(
    () =>
      page === null
        ? []
        : layoutOutlines(
            boxes,
            { top: page.top, width, height },
            page.content,
            // Read only as a hint for where labels sat; a stale value just
            // means a label may move once.
            // eslint-disable-next-line react-hooks/refs
            previous.current.page === page ? previous.current.labels : new Map()
          ),
    [page, boxes, width, height]
  )
  React.useEffect(() => {
    previous.current = {
      page,
      labels: new Map(layout.map(({ box, placed }) => [box.id, placed])),
    }
  }, [page, layout])

  const current = mode === null ? null : selected
  const part = parts.find((item) => item.id === current)
  const owner = part?.parent ?? current
  const ownerLabel =
    targets.find((target) => target.id === owner)?.label ?? owner ?? ""
  const label =
    part?.label ?? targets.find((target) => target.id === current)?.label ?? ""
  // Read again whenever the boxes move, as after a resize.
  const grid = part && boxes.length > 0 ? gridOf(part.parent) : null
  const handles = handlesOf(part, targets, flags, grid?.columns ?? 1)
  const bar = owner === null ? undefined : actions?.(owner)

  React.useImperativeHandle(ref, () => ({
    start: (target?: string) => {
      setSelected(target ?? null)
      setStatus("")
      if (target) reveal(target)
      focusAfter.current = target ? `outline:${target}` : null
      start()
    },
  }))

  React.useEffect(() => {
    if (mode !== null) return
    const run = afterExit.current
    afterExit.current = null
    run?.()
  }, [mode])

  React.useEffect(() => {
    const key = focusAfter.current
    if (key === null) return
    const element = document.querySelector<HTMLElement>(
      `[data-pliant-point-focus="${CSS.escape(key)}"]`
    )
    if (!element) return
    focusAfter.current = null
    if (document.activeElement !== element) element.focus()
  }, [layout, current])

  function select(target: string) {
    if (mode === "hold") start()
    reveal(target)
    setSelected(target)
    focusAfter.current = `outline:${target}`
    const name =
      parts.find((item) => item.id === target)?.label ??
      targets.find((item) => item.id === target)?.label ??
      target
    setStatus(messages.pointModeSelected(name))
  }

  function apply(op: Op | undefined, done: string, focus: string) {
    if (!op || !part) return
    const result = store.applyOps("personal", [op])
    focusAfter.current = focus
    setStatus(result.success ? done : messages.pointModeFailed(part.label))
    return result.success
  }

  const shown = new Set(boxes.map((box) => box.id))

  function move(to: (index: number) => number, focus: string) {
    if (!part || !handles.move) return
    const order = siblingsOf(part, shown)
    const index = to(order.indexOf(part.id))
    const position = Math.max(0, Math.min(order.length - 1, index))
    apply(
      moveOp(part.address, order, part.id, index),
      messages.pointModeMoved(part.label, position + 1, order.length),
      focus
    )
  }

  function resize(columns: number, focus: string) {
    if (!part || !handles.span || !grid) return
    const next = Math.max(1, Math.min(grid.columns, columns))
    if (next === spanOf(part.id, grid.columns)) return
    apply(
      spanOp(part.address, next, window.innerWidth),
      messages.pointModeResized(part.label, next),
      focus
    )
  }

  function hide() {
    if (!part || !handles.hide) return
    if (
      apply(
        { op: "hide", target: part.address },
        messages.pointModeHidden(part.label),
        `outline:${part.parent}`
      )
    ) {
      setSelected(part.parent)
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (
      !part ||
      !(event.target instanceof Element) ||
      event.target.closest("[data-pliant-point-selection]") === null
    ) {
      return
    }
    const focus =
      event.target.getAttribute("data-pliant-point-focus") ??
      `outline:${part.id}`
    const step =
      event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : event.key === "ArrowRight" || event.key === "ArrowDown"
          ? 1
          : 0
    if (step !== 0 && event.shiftKey && handles.span && grid) {
      resize(spanOf(part.id, grid.columns) + step, focus)
    } else if (step !== 0 && !event.shiftKey && handles.move) {
      move((index) => index + step, focus)
    } else if (
      (event.key === "Delete" || event.key === "Backspace") &&
      handles.hide
    ) {
      hide()
    } else {
      return
    }
    event.preventDefault()
    event.stopPropagation()
  }

  function startDrag(
    kind: Drag["kind"],
    event: React.PointerEvent<HTMLButtonElement>
  ) {
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({ kind, x: event.clientX, y: event.clientY, dx: 0, dy: 0 })
  }

  function moveDrag(event: React.PointerEvent<HTMLButtonElement>) {
    setDrag(
      (value) =>
        value && {
          ...value,
          dx: event.clientX - value.x,
          dy: event.clientY - value.y,
        }
    )
  }

  function endDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const done = drag
    setDrag(null)
    if (!done || !part) return
    const focus = event.currentTarget.getAttribute("data-pliant-point-focus")
    if (done.kind === "move") {
      // Dropped on the shown sibling whose middle is nearest the pointer.
      const order = siblingsOf(part, shown)
      let nearest = -1
      let distance = Number.POSITIVE_INFINITY
      for (const [index, sibling] of order.entries()) {
        const box = boxes.find((item) => item.id === sibling)
        if (!box) continue
        const next = Math.hypot(
          box.left + box.width / 2 - event.clientX,
          box.top + box.height / 2 - event.clientY
        )
        if (next < distance) {
          distance = next
          nearest = index
        }
      }
      move(() => nearest, focus ?? `outline:${part.id}`)
    } else if (grid) {
      const box = boxes.find((item) => item.id === part.id)
      if (!box) return
      const column = (grid.width - grid.gap * (grid.columns - 1)) / grid.columns
      resize(
        Math.round((box.width + done.dx + grid.gap) / (column + grid.gap)),
        focus ?? `outline:${part.id}`
      )
    }
  }

  function runAfterExit(run: (() => void) | undefined) {
    if (!run) return
    afterExit.current = run
    exit()
  }

  const selectedOutline = layout.find(({ box }) => box.id === current)

  // The selection's handles and bar, right after its outline, so Tab
  // reaches them from it.
  const selection = (
    <>
      {selectedOutline && part && drag && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-xl border-2 border-dashed border-primary bg-primary/10"
          style={{
            top:
              selectedOutline.outline.top +
              (drag.kind === "move" ? drag.dy : 0),
            left:
              selectedOutline.outline.left +
              (drag.kind === "move" ? drag.dx : 0),
            width: Math.max(
              24,
              selectedOutline.outline.right -
                selectedOutline.outline.left +
                (drag.kind === "resize" ? drag.dx : 0)
            ),
            height:
              selectedOutline.outline.bottom - selectedOutline.outline.top,
          }}
        />
      )}
      {selectedOutline && part && (
        <div data-pliant-point-selection="">
          {handles.move && (
            <button
              type="button"
              aria-label={messages.pointModeMove(label)}
              data-pliant-point-focus="move"
              className={handleClassName}
              style={{
                top: selectedOutline.outline.top - 12,
                left:
                  (selectedOutline.outline.left +
                    selectedOutline.outline.right) /
                    2 -
                  12,
              }}
              onPointerDown={(event) => {
                startDrag("move", event)
              }}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={() => {
                setDrag(null)
              }}
            >
              <GripVerticalIcon className="rotate-90" />
            </button>
          )}
          {handles.span && (
            <button
              type="button"
              aria-label={messages.pointModeResize(label)}
              data-pliant-point-focus="resize"
              className={cnHandle("cursor-ew-resize")}
              style={{
                top:
                  (selectedOutline.outline.top +
                    selectedOutline.outline.bottom) /
                    2 -
                  12,
                left: selectedOutline.outline.right - 12,
              }}
              onPointerDown={(event) => {
                startDrag("resize", event)
              }}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={() => {
                setDrag(null)
              }}
            >
              <MoveHorizontalIcon />
            </button>
          )}
          {handles.hide && (
            <button
              type="button"
              aria-label={messages.pointModeHide(label)}
              data-pliant-point-focus="hide"
              className={cnHandle("cursor-pointer")}
              style={{
                top: selectedOutline.outline.top - 12,
                left: selectedOutline.outline.right - 12,
              }}
              onClick={hide}
            >
              <EyeOffIcon />
            </button>
          )}
        </div>
      )}
      {selectedOutline && owner !== null && (
        <div
          role="toolbar"
          aria-label={messages.pointModeBar(ownerLabel)}
          className="absolute flex cursor-default items-center gap-1 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
          style={barPosition(selectedOutline.outline, {
            top: page?.top ?? 0,
            width,
            height,
          })}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!bar?.onAsk}
            onClick={() => {
              runAfterExit(bar?.onAsk)
            }}
          >
            <SparklesIcon />
            {messages.pointModeAsk}
            {!bar?.onAsk && bar?.unavailable}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!bar?.onAdjust}
            onClick={() => {
              runAfterExit(bar?.onAdjust)
            }}
          >
            <SlidersHorizontalIcon />
            {messages.pointModeAdjust}
            {!bar?.onAdjust && bar?.unavailable}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!bar?.onReset || bar.canReset === false}
            onClick={() => {
              bar?.onReset?.()
              focusAfter.current = `outline:${current ?? ""}`
              setStatus(messages.pointModeReset(ownerLabel))
            }}
          >
            <RotateCcwIcon />
            {messages.pointModeResetAction}
            {!bar?.onReset && bar?.unavailable}
          </Button>
        </div>
      )}
    </>
  )

  return (
    <>
      {trigger && <Slot.Root {...getTriggerProps()}>{trigger}</Slot.Root>}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
      {mode !== null &&
        createPortal(
          <div
            {...getLayerProps()}
            // Before point mode's own keys, which would move focus instead.
            onKeyDownCapture={onKeyDown}
            aria-label={messages.pointModeLabel}
            aria-describedby={mode === "toggle" ? `${id}-help` : undefined}
            className="pointer-events-auto fixed inset-0 z-40 cursor-crosshair"
          >
            {mode === "toggle" && (
              <p id={`${id}-help`} className="sr-only">
                {messages.pointModeHelp}
              </p>
            )}
            <p role="status" aria-live="polite" className="sr-only">
              {status}
            </p>
            {/* Outlines stay below a sticky header, so they never draw
                over it. */}
            <div
              className="absolute inset-0"
              style={{ clipPath: `inset(${String(page?.top ?? 0)}px 0 0 0)` }}
            >
              {layout.map(({ box, outline, label: placement }) => (
                <React.Fragment key={box.id}>
                  <button
                    type="button"
                    aria-pressed={box.id === current}
                    data-pliant-point-target={box.id}
                    data-pliant-point-focus={`outline:${box.id}`}
                    data-pliant-point-selection={
                      box.id === current ? "" : undefined
                    }
                    className="absolute cursor-pointer rounded-xl bg-primary/5 shadow-lg ring-2 shadow-primary/25 ring-primary/60 outline-none hover:bg-primary/10 hover:shadow-primary/40 hover:ring-primary focus-visible:bg-primary/10 focus-visible:ring-4 focus-visible:shadow-primary/40 focus-visible:ring-primary aria-pressed:bg-primary/10 aria-pressed:ring-primary motion-safe:animate-in motion-safe:transition-[background-color,box-shadow] motion-safe:fade-in-0"
                    style={{
                      top: outline.top,
                      left: outline.left,
                      width: outline.right - outline.left,
                      height: outline.bottom - outline.top,
                    }}
                    onClick={() => {
                      select(box.id)
                    }}
                  >
                    <span
                      className="absolute h-5 max-w-48 truncate rounded-md bg-primary px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-primary-foreground shadow-sm"
                      style={placement}
                    >
                      {box.label}
                    </span>
                  </button>
                  {box.id === current && selection}
                </React.Fragment>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

const handleClassName =
  "absolute flex size-6 cursor-grab touch-none items-center justify-center rounded-full border bg-background text-foreground shadow-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing [&_svg]:size-3.5"

function cnHandle(cursor: string) {
  return `${handleClassName.replace("cursor-grab ", "").replace(" active:cursor-grabbing", "")} ${cursor}`
}

// Under the selection, or above it, or else inside its bottom edge on
// screen, as for a part taller than the screen, never under a sticky header.
function barPosition(
  outline: Rect,
  viewport: { top: number; width: number; height: number }
) {
  const barHeight = 40
  const below = outline.bottom + ring + gap
  const above = outline.top - ring - gap - barHeight
  const top =
    below + barHeight <= viewport.height
      ? below
      : above >= viewport.top
        ? above
        : Math.max(
            viewport.top + gap,
            Math.min(outline.bottom, viewport.height) - gap - barHeight
          )
  return {
    top: Math.max(
      viewport.top + gap,
      Math.min(top, viewport.height - gap - barHeight)
    ),
    left: Math.max(ring, Math.min(outline.left, viewport.width - 280)),
  }
}

export {
  PliantPointMode,
  type PliantPointActions,
  type PliantPointFlags,
  type PliantPointModeHandle,
  type PliantPointTarget,
}
