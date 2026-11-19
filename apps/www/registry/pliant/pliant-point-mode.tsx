"use client"

import * as React from "react"
import { cn } from "cn"
import { SquareDashedMousePointerIcon } from "lucide-react"
import { Slot } from "radix-ui"
import { createPortal } from "react-dom"

import { Button } from "@/components/ui/button"

/** A node users can point at: its id and the label shown on its outline. */
interface PliantPointTarget {
  id: string
  label: string
}

type Mode = "hold" | "toggle"

interface Box {
  id: string
  label: string
  top: number
  left: number
  width: number
  height: number
}

// Long enough that Alt pressed as part of a shortcut never lights the page up.
const holdDelay = 250

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

function isShortcut(event: KeyboardEvent) {
  return (
    event.key === "." &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey
  )
}

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
// its own, so it is outlined around its children.
function boxElementsOf(element: Element): Element[] {
  return getComputedStyle(element).display === "contents"
    ? [...element.children].flatMap(boxElementsOf)
    : [element]
}

function rectOf(element: Element) {
  return union(
    boxElementsOf(element)
      .map((box) => box.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
  )
}

function elementOf(id: string) {
  return document.querySelector(`[data-pliant-id="${CSS.escape(id)}"]`)
}

const boxKeys = ["id", "label", "top", "left", "width", "height"] as const

function sameBoxes(current: readonly Box[], next: readonly Box[]) {
  return (
    current.length === next.length &&
    current.every((box, index) =>
      boxKeys.every((key) => box[key] === next[index]?.[key])
    )
  )
}

const navigationKeys: Readonly<Record<string, (index: number) => number>> = {
  ArrowDown: (index) => index + 1,
  ArrowRight: (index) => index + 1,
  ArrowUp: (index) => index - 1,
  ArrowLeft: (index) => index - 1,
  Home: () => 0,
  End: () => -1,
}

/**
 * Point mode: users point at the part of the page they want to change
 * instead of picking it from a list. Hold Alt (Option on a Mac), press ⌘. or
 * Ctrl+., or press the toggle, and the targets on the page are outlined with
 * their labels; clicking one, or moving to it with Tab or the arrow keys and
 * pressing Enter, calls `onPick` with its id. Release Alt, press Escape or
 * click anywhere else to leave without picking.
 *
 * A target is found on the page by its `data-pliant-id`, so it must be a
 * Pliant node, like a `PliantRegion`. Point mode ignores Alt and the
 * shortcut while focus is in a text field, and Alt held together with
 * another key, so the app's and the browser's shortcuts keep working.
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
  /** The element that toggles point mode. Defaults to a "Point" button. */
  trigger?: React.ReactElement
}) {
  const [mode, setMode] = React.useState<Mode | null>(null)
  const [boxes, setBoxes] = React.useState<readonly Box[]>([])
  const [announcement, setAnnouncement] = React.useState("")
  const layerRef = React.useRef<HTMLDivElement>(null)
  const returnFocus = React.useRef<HTMLElement | null>(null)
  const focusOnShow = React.useRef(false)
  const holdTimer = React.useRef<number | undefined>(undefined)
  const heldThisPress = React.useRef(false)
  const active = mode !== null

  function enter(next: Mode) {
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    focusOnShow.current = next === "toggle"
    setBoxes([])
    setMode(next)
    setAnnouncement(
      next === "toggle"
        ? "Point mode on. Use Tab or the arrow keys to move between the parts you can change, Enter to pick one, Escape to leave."
        : "Point mode on. Click the part you want to change."
    )
  }

  function exit({ restoreFocus }: { restoreFocus: boolean }) {
    if (
      restoreFocus &&
      layerRef.current?.contains(document.activeElement) === true
    ) {
      returnFocus.current?.focus()
    }
    returnFocus.current = null
    setMode(null)
    setAnnouncement("Point mode off.")
  }

  function pick(id: string) {
    returnFocus.current = null
    setMode(null)
    setAnnouncement("")
    onPick(id)
  }

  function cancelHold() {
    window.clearTimeout(holdTimer.current)
    holdTimer.current = undefined
  }

  const onKeyDown = React.useEffectEvent((event: KeyboardEvent) => {
    if (event.isComposing) {
      return
    }
    if (isShortcut(event)) {
      cancelHold()
      if (isEditable(document.activeElement)) {
        return
      }
      event.preventDefault()
      if (mode === null) {
        enter("toggle")
      } else {
        exit({ restoreFocus: true })
      }
      return
    }
    if (event.key === "Alt") {
      if (
        event.repeat ||
        mode !== null ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isEditable(document.activeElement)
      ) {
        return
      }
      cancelHold()
      holdTimer.current = window.setTimeout(() => {
        holdTimer.current = undefined
        heldThisPress.current = true
        enter("hold")
      }, holdDelay)
      return
    }
    // Alt with another key, including a macOS dead key, is a shortcut or
    // a character, not a hold.
    cancelHold()
    if (mode === "hold") {
      exit({ restoreFocus: false })
    } else if (
      mode === "toggle" &&
      event.key === "Escape" &&
      !event.defaultPrevented
    ) {
      event.preventDefault()
      exit({ restoreFocus: true })
    }
  })

  const onKeyUp = React.useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== "Alt") {
      return
    }
    cancelHold()
    // Releasing Alt alone moves focus to the browser's menu bar on Windows.
    if (heldThisPress.current) {
      heldThisPress.current = false
      event.preventDefault()
    }
    if (mode === "hold") {
      exit({ restoreFocus: false })
    }
  })

  // Alt+Tab and similar switches never deliver the keyup.
  const onBlur = React.useEffectEvent(() => {
    cancelHold()
    heldThisPress.current = false
    if (mode === "hold") {
      exit({ restoreFocus: false })
    }
  })

  React.useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      onKeyDown(event)
    }
    const keyUp = (event: KeyboardEvent) => {
      onKeyUp(event)
    }
    const blur = () => {
      onBlur()
    }
    window.addEventListener("keydown", keyDown)
    window.addEventListener("keyup", keyUp)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keydown", keyDown)
      window.removeEventListener("keyup", keyUp)
      window.removeEventListener("blur", blur)
      window.clearTimeout(holdTimer.current)
    }
  }, [])

  const measure = React.useEffectEvent(
    (observe: (element: Element) => void) => {
      const next = targets.flatMap((target) => {
        const element = elementOf(target.id)
        const rect = element && rectOf(element)
        if (!element || !rect) {
          return []
        }
        boxElementsOf(element).forEach(observe)
        return [
          {
            id: target.id,
            label: target.label,
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          },
        ]
      })
      next.sort((a, b) => a.top - b.top || a.left - b.left)
      setBoxes((current) => (sameBoxes(current, next) ? current : next))
    }
  )

  React.useEffect(() => {
    if (!active) {
      return
    }
    let frame = 0
    const observed = new Set<Element>()
    const resizeObserver = new ResizeObserver(schedule)
    const mutationObserver = new MutationObserver(schedule)
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
    window.addEventListener("scroll", schedule, {
      capture: true,
      passive: true,
    })
    window.addEventListener("resize", schedule)
    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener("scroll", schedule, { capture: true })
      window.removeEventListener("resize", schedule)
    }
  }, [active])

  React.useEffect(() => {
    const first = layerRef.current?.querySelector("button")
    if (focusOnShow.current && first) {
      focusOnShow.current = false
      first.focus()
    }
  }, [boxes])

  return (
    <>
      <Slot.Root
        aria-pressed={active}
        aria-keyshortcuts="Meta+Period Control+Period"
        data-state={active ? "on" : "off"}
        onClick={() => {
          if (active) {
            exit({ restoreFocus: true })
          } else {
            enter("toggle")
          }
        }}
      >
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <SquareDashedMousePointerIcon />
            Point
          </Button>
        )}
      </Slot.Root>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
      {active &&
        createPortal(
          <div
            ref={layerRef}
            role="group"
            aria-label="Parts you can change"
            data-slot="pliant-point-mode"
            data-mode={mode}
            className="fixed inset-0 z-40 cursor-crosshair"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                exit({ restoreFocus: true })
              }
            }}
            onKeyDown={(event) => {
              const buttons = [
                ...event.currentTarget.querySelectorAll("button"),
              ]
              const index = buttons.findIndex(
                (button) => button === document.activeElement
              )
              const move =
                event.key === "Tab"
                  ? event.shiftKey
                    ? index - 1
                    : index + 1
                  : navigationKeys[event.key]?.(index)
              if (move === undefined || buttons.length === 0) {
                return
              }
              event.preventDefault()
              const length = buttons.length
              buttons[((move % length) + length) % length]?.focus()
            }}
          >
            {boxes.map((box) => (
              <button
                key={box.id}
                type="button"
                data-pliant-point-target={box.id}
                className="motion-safe:animate-in motion-safe:fade-in-0 absolute cursor-pointer rounded-lg bg-primary/5 shadow-lg ring-2 shadow-primary/25 ring-primary/60 outline-none hover:bg-primary/10 hover:shadow-primary/40 hover:ring-primary focus-visible:bg-primary/10 focus-visible:ring-4 focus-visible:shadow-primary/40 focus-visible:ring-primary motion-safe:transition-[background-color,box-shadow]"
                style={{
                  top: box.top,
                  left: box.left,
                  width: box.width,
                  height: box.height,
                }}
                onClick={() => {
                  pick(box.id)
                }}
              >
                <span
                  className={cn(
                    "absolute left-0 rounded-md bg-primary px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-primary-foreground shadow-sm",
                    box.top < 24 ? "top-1 left-1" : "-top-6"
                  )}
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
