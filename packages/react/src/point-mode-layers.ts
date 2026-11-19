const textInputTypes = new Set([
  "date",
  "datetime-local",
  "email",
  "month",
  "number",
  "password",
  "search",
  "tel",
  "text",
  "time",
  "url",
  "week",
])

function isEditable(element: Element | null) {
  if (!(element instanceof HTMLElement)) {
    return false
  }
  if (element instanceof HTMLInputElement) {
    return textInputTypes.has(element.type)
  }
  return (
    element.isContentEditable ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  )
}

// Typing in the ask panel's prompt doesn't use Alt alone or the shortcut, and
// pointing again from there is how users ask about something else next.
export function blocksPointMode(element: Element | null) {
  return (
    isEditable(element) &&
    element?.closest('[data-slot="pliant-ask-panel"]') == null
  )
}

function isModal(dialog: Element) {
  try {
    return dialog.matches(":modal")
  } catch {
    return false
  }
}

// Another layer owns the keyboard and the pointer until it closes: a modal
// dialog, another instance's point mode included, a focused listbox or menu,
// or a Radix modal layer, which turns off pointer events on the body. A modal
// can make the page inert or keep focus out of it, so being open is enough.
export function anotherLayerIsOpen() {
  return (
    document.body.style.pointerEvents === "none" ||
    document.querySelector(
      '[data-slot="pliant-point-mode"],[role="dialog"][aria-modal="true"]'
    ) != null ||
    [...document.querySelectorAll("dialog[open]")].some(isModal) ||
    document.activeElement?.closest(
      '[role="listbox"],[role="menu"],dialog[open]'
    ) != null
  )
}

// `code` finds the key on layouts where "." needs Shift.
export function isShortcut(event: KeyboardEvent) {
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    (event.key === "." || (event.code === "Period" && !event.shiftKey))
  )
}

function isPointModeLayer(element: Element) {
  return element.matches('[data-slot="pliant-point-mode"]')
}

// Like a modal, everything but `layer`, its ancestors and other point mode
// layers, including nodes added while it is on, until the returned function
// restores the elements it made inert.
export function makeOthersInert(layer: Element) {
  const madeInert = new Set<Element>()
  const path = new Set<Element>()
  for (
    let node: Element | null = layer;
    node && node !== document.body;
    node = node.parentElement
  ) {
    path.add(node)
  }
  const hide = (nodes: Iterable<Node>) => {
    for (const node of nodes) {
      if (
        node instanceof Element &&
        !path.has(node) &&
        !node.hasAttribute("inert") &&
        !isPointModeLayer(node)
      ) {
        node.setAttribute("inert", "")
        madeInert.add(node)
      }
    }
  }
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      hide(record.addedNodes)
    }
  })
  for (const parent of [document.body, ...path]) {
    if (parent !== layer) {
      hide(parent.children)
      observer.observe(parent, { childList: true })
    }
  }
  return () => {
    observer.disconnect()
    for (const element of madeInert) {
      element.removeAttribute("inert")
    }
  }
}
