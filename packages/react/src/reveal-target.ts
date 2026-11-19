function overlaps(a: DOMRect, b: DOMRect) {
  return (
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  )
}

// A panel docked at the bottom of the screen can cover the node being
// changed, so its preview wouldn't show. The node is brought to the top then,
// unless it starts on screen near the top of the room above the panel.
// Scrolling can't help a panel that reaches the top of the viewport.
export function revealTarget(id: string, panel: HTMLElement | null) {
  const node = document.querySelector(`[data-pliant-id="${CSS.escape(id)}"]`)
  if (!node || !panel) {
    return
  }
  const room = panel.getBoundingClientRect()
  const rect = node.getBoundingClientRect()
  if (
    room.top <= 0 ||
    !overlaps(room, rect) ||
    (rect.top >= 0 && rect.top <= room.top / 3)
  ) {
    return
  }
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches
  node.scrollIntoView({
    block: "start",
    behavior: reduceMotion ? "instant" : "smooth",
  })
}
