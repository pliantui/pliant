// Docked at the bottom of the screen, the panel can cover the node being
// changed, so its preview wouldn't show. The node is brought to the top then,
// unless it already fits above the panel or starts near the top of the room
// left there. Beside the page, the page is left where the user put it.
export function revealTarget(id: string, panel: HTMLElement | null) {
  const node = document.querySelector(`[data-pliant-id="${CSS.escape(id)}"]`)
  const room = panel?.getBoundingClientRect().top ?? 0
  if (!node || room <= 0) {
    return
  }
  const { top, bottom } = node.getBoundingClientRect()
  if (top >= 0 && (bottom <= room || top <= room / 3)) {
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
