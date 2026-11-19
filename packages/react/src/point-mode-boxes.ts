/**
 * Where a target shows on the page, in viewport coordinates, and where its
 * label goes: at the outline's start or, near the viewport's right edge, at
 * its end, moved in by `labelInset` so it stays on screen.
 */
export interface PointModeBox {
  id: string
  label: string
  top: number
  left: number
  width: number
  height: number
  labelAlign: "start" | "end"
  labelInset: number
}

// The widest a label gets, a `max-w-48`.
const labelRoom = 192

function union(rects: readonly DOMRect[]) {
  if (rects.length === 0) {
    return null
  }
  const top = Math.min(...rects.map((rect) => rect.top))
  const left = Math.min(...rects.map((rect) => rect.left))
  const bottom = Math.max(...rects.map((rect) => rect.bottom))
  const right = Math.max(...rects.map((rect) => rect.right))
  return new DOMRect(left, top, right - left, bottom - top)
}

// A `display: contents` element, like a region's slot wrapper, has no box of
// its own, so it is outlined around its children, text included.
function boxNodesOf(node: Node): (Element | Text)[] {
  if (node instanceof Element) {
    return getComputedStyle(node).display === "contents"
      ? [...node.childNodes].flatMap(boxNodesOf)
      : [node]
  }
  return node instanceof Text && node.data.trim() !== "" ? [node] : []
}

function rectOfNode(node: Element | Text) {
  if (node instanceof Element) {
    return node.getBoundingClientRect()
  }
  const range = document.createRange()
  range.selectNodeContents(node)
  return range.getBoundingClientRect()
}

function rectOf(nodes: readonly (Element | Text)[]) {
  return union(
    nodes.map(rectOfNode).filter((rect) => rect.width > 0 && rect.height > 0)
  )
}

export function measureBoxes(
  targets: readonly { id: string; label: string }[],
  observe: (element: Element) => void
): PointModeBox[] {
  const viewport = document.documentElement.clientWidth
  const boxes = targets.flatMap((target) => {
    const element = document.querySelector(
      `[data-pliant-id="${CSS.escape(target.id)}"]`
    )
    const nodes = element ? boxNodesOf(element) : []
    const rect = rectOf(nodes)
    if (!rect) {
      return []
    }
    for (const node of nodes) {
      if (node instanceof Element) {
        observe(node)
      }
    }
    const end = rect.left + labelRoom > viewport
    return [
      {
        id: target.id,
        label: target.label,
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        labelAlign: end ? ("end" as const) : ("start" as const),
        labelInset: Math.max(0, end ? rect.right - viewport : -rect.left),
      },
    ]
  })
  return boxes.sort((a, b) => a.top - b.top || a.left - b.left)
}

const boxKeys = [
  "id",
  "label",
  "top",
  "left",
  "width",
  "height",
  "labelAlign",
  "labelInset",
] as const

export function sameBoxes(
  current: readonly PointModeBox[],
  next: readonly PointModeBox[]
) {
  return (
    current.length === next.length &&
    current.every((box, index) =>
      boxKeys.every((key) => box[key] === next[index]?.[key])
    )
  )
}

/**
 * Calls `measure` once a frame at most, now and whenever the page scrolls,
 * resizes or changes outside `layer`, and when an element it observes
 * resizes, until the returned function stops it.
 */
export function watchLayout(
  measure: (observe: (element: Element) => void) => void,
  layer: () => Element | null
) {
  let frame = 0
  const observed = new Set<Element>()
  const resizeObserver = new ResizeObserver(schedule)
  const mutationObserver = new MutationObserver((records) => {
    if (records.some((record) => !layer()?.contains(record.target))) {
      schedule()
    }
  })
  const observe = (element: Element) => {
    if (!observed.has(element)) {
      observed.add(element)
      resizeObserver.observe(element)
    }
  }
  function schedule() {
    if (frame === 0) {
      frame = requestAnimationFrame(() => {
        frame = 0
        measure(observe)
      })
    }
  }
  schedule()
  resizeObserver.observe(document.documentElement)
  mutationObserver.observe(document.body, {
    attributes: true,
    childList: true,
    subtree: true,
  })
  window.addEventListener("scroll", schedule, { capture: true, passive: true })
  window.addEventListener("resize", schedule)
  return () => {
    cancelAnimationFrame(frame)
    resizeObserver.disconnect()
    mutationObserver.disconnect()
    window.removeEventListener("scroll", schedule, { capture: true })
    window.removeEventListener("resize", schedule)
  }
}
