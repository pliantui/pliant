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

// Everything but the point mode layers, including nodes added while it is on,
// until the returned function restores the elements it made inert.
export function makePageInert() {
  const madeInert = new Set<Element>()
  const hide = (elements: Iterable<Node>) => {
    for (const element of elements) {
      if (
        element instanceof Element &&
        !element.hasAttribute("inert") &&
        !element.matches('[data-slot="pliant-point-mode"]')
      ) {
        element.setAttribute("inert", "")
        madeInert.add(element)
      }
    }
  }
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      hide(record.addedNodes)
    }
  })
  hide(document.body.children)
  observer.observe(document.body, { childList: true })
  return () => {
    observer.disconnect()
    for (const element of madeInert) {
      element.removeAttribute("inert")
    }
  }
}
