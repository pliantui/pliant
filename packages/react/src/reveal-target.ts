// A panel docked at the bottom of the screen can cover the node being
// changed, so its preview wouldn't show. The node is brought to the top then,
// unless it fits above the panel or starts near the top of the room left
// there. A panel beside the node, at the side or floating, never covers it,
// and scrolling can't help a panel that reaches the top of the viewport.
export function revealTarget(id: string, panel: HTMLElement | null) {
  const node = document.querySelector(`[data-pliant-id="${CSS.escape(id)}"]`)
  if (!node || !panel) {
    return
  }
  const room = panel.getBoundingClientRect()
  const { top, bottom, left, right } = node.getBoundingClientRect()
  if (room.top <= 0 || right <= room.left || left >= room.right) {
    return
  }
  if (top >= 0 && (bottom <= room.top || top <= room.top / 3)) {
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
