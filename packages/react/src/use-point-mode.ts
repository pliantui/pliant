import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type Ref,
} from "react"

import { composeHandler, composeRef } from "./compose-props"
import type { PliantMessages } from "./pliant-messages"
import {
  measureBoxes,
  sameBoxes,
  watchLayout,
  type PointModeBox,
} from "./point-mode-boxes"
import {
  anotherLayerIsOpen,
  blocksPointMode,
  isShortcut,
  makeOthersInert,
} from "./point-mode-layers"
import { usePliantMessages } from "./use-pliant-messages"

const pointModeMessages: Pick<PliantMessages, "pointModeOn" | "pointModeOff"> =
  {
    pointModeOn: "Point mode on. Click the part you want to change.",
    pointModeOff: "Point mode off.",
  }

// Long enough that Alt pressed as part of a shortcut never lights the page up.
const holdDelay = 250

const navigationKeys: Readonly<Record<string, (index: number) => number>> = {
  ArrowDown: (index) => index + 1,
  ArrowRight: (index) => index + 1,
  ArrowUp: (index) => index - 1,
  ArrowLeft: (index) => index - 1,
  Home: () => 0,
  End: () => -1,
}

/** @experimental */
export interface UsePointModeOptions {
  /** The nodes users can point at, with the labels shown on their outlines. */
  readonly targets: readonly { readonly id: string; readonly label: string }[]
  /** Called with the id of the target the user picked. */
  readonly onPick: (id: string) => void
  /**
   * The widest a box's label gets, in pixels, to keep it on screen: match
   * the label's maximum width. Defaults to 192, a `max-w-48`.
   */
  readonly labelWidth?: number | undefined
}

/**
 * The state and behaviour of point mode, where users point at the part of the
 * page they want to change: holding Alt (Option on a Mac), pressing ⌘. or
 * Ctrl+., or pressing the element given `getTriggerProps()` turns it on, and
 * `boxes` then holds where each target shows on the page, found by its
 * `data-pliant-id`. Render a `button` per box inside the element given
 * `getLayerProps()`, calling `pick` with its id. Releasing Alt, Escape, or a
 * click on the layer outside the boxes leaves without picking. Pass your own
 * handlers and ref to the getters rather than after the spread: a handler
 * runs first, and point mode skips its own when it calls
 * `event.preventDefault()`.
 *
 * Alt and the shortcut are ignored while focus is in a text field other than
 * the ask panel's prompt (`data-slot="pliant-ask-panel"`), in a listbox or a
 * menu, and while a modal dialog is open or the body has
 * `pointer-events: none`, as Radix sets for its modal layers; Alt is also
 * ignored with another key, so the app's and the browser's shortcuts keep
 * working. The trigger always works.
 *
 * Turned on from the trigger or the shortcut, the layer is a modal dialog:
 * the rest of the page (all but the layer and its ancestors) is `inert`
 * until point mode ends, focus moves to the
 * first box, Tab, the arrow keys, Home and End move between the boxes, and
 * focus goes back to where it was unless `onPick` moves it. While Alt is
 * held, nothing is made inert and focus stays put; `announcement` says the
 * mode changed, for a polite live region outside the layer. `mode` is
 * `"hold"`, `"toggle"`, or `null` while point mode is off.
 *
 * @experimental
 */
export function usePointMode({
  targets,
  onPick,
  labelWidth = 192,
}: UsePointModeOptions) {
  const [mode, setMode] = useState<"hold" | "toggle" | null>(null)
  const [boxes, setBoxes] = useState<readonly PointModeBox[]>([])
  const [announcement, setAnnouncement] = useState("")
  const messages = usePliantMessages(pointModeMessages)
  const layerRef = useRef<HTMLElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const focusOnShow = useRef(false)
  const holdTimer = useRef<number | undefined>(undefined)
  const heldThisPress = useRef(false)
  const active = mode !== null

  function enter(next: "hold" | "toggle") {
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    focusOnShow.current = next === "toggle"
    setBoxes([])
    setMode(next)
    // The page holding the live region is inert in toggle mode, where the
    // dialog and the focus moving in and out of it say the same.
    setAnnouncement(next === "hold" ? messages.pointModeOn : "")
  }

  function exit() {
    setMode(null)
    setAnnouncement(mode === "hold" ? messages.pointModeOff : "")
  }

  function pick(id: string) {
    setMode(null)
    setAnnouncement("")
    onPick(id)
  }

  function cancelHold() {
    window.clearTimeout(holdTimer.current)
    holdTimer.current = undefined
  }

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.isComposing) {
      return
    }
    if (isShortcut(event)) {
      cancelHold()
      if (
        event.defaultPrevented ||
        blocksPointMode(document.activeElement) ||
        (mode === null && anotherLayerIsOpen())
      ) {
        return
      }
      event.preventDefault()
      if (mode === null) {
        enter("toggle")
      } else {
        exit()
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
        blocksPointMode(document.activeElement) ||
        anotherLayerIsOpen()
      ) {
        return
      }
      cancelHold()
      holdTimer.current = window.setTimeout(() => {
        holdTimer.current = undefined
        if (anotherLayerIsOpen()) {
          return
        }
        heldThisPress.current = true
        enter("hold")
      }, holdDelay)
      return
    }
    // Alt with another key, including a macOS dead key, is a shortcut or
    // a character, not a hold.
    cancelHold()
    if (mode === "hold") {
      exit()
    } else if (
      mode === "toggle" &&
      event.key === "Escape" &&
      !event.defaultPrevented
    ) {
      event.preventDefault()
      exit()
    }
  })

  const onKeyUp = useEffectEvent((event: KeyboardEvent) => {
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
      exit()
    }
  })

  // Alt+Tab and similar switches never deliver the keyup.
  const onBlur = useEffectEvent(() => {
    cancelHold()
    heldThisPress.current = false
    if (mode === "hold") {
      exit()
    }
  })

  useEffect(() => {
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

  const measure = useEffectEvent((observe: (element: Element) => void) => {
    const next = measureBoxes(targets, labelWidth, observe)
    setBoxes((current) => (sameBoxes(current, next) ? current : next))
  })

  useEffect(() => {
    if (!active) {
      return
    }
    return watchLayout(measure, () => layerRef.current)
  }, [active])

  useEffect(() => {
    if (mode === null) {
      return
    }
    const restore = returnFocus.current
    const layer = layerRef.current
    const restoreInert =
      mode === "toggle" && layer ? makeOthersInert(layer) : undefined
    return () => {
      restoreInert?.()
      const focused = document.activeElement
      if (!focused || focused === document.body || !focused.isConnected) {
        restore?.focus()
      }
    }
  }, [mode])

  useEffect(() => {
    const first = layerRef.current?.querySelector("button")
    if (focusOnShow.current && first) {
      focusOnShow.current = false
      first.focus()
    }
  }, [boxes])

  function toggle() {
    if (active) {
      exit()
    } else {
      enter("toggle")
    }
  }

  function leaveOnBackdrop(event: ReactMouseEvent<HTMLElement>) {
    if (event.target === event.currentTarget) {
      exit()
    }
  }

  function moveFocus(event: ReactKeyboardEvent<HTMLElement>) {
    const buttons = [...event.currentTarget.querySelectorAll("button")]
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
  }

  return {
    mode,
    boxes,
    announcement,
    pick,
    getTriggerProps: <TElement extends HTMLElement = HTMLElement>(props?: {
      readonly onClick?:
        ((event: ReactMouseEvent<TElement>) => void) | undefined
    }) => ({
      "aria-pressed": active,
      "aria-keyshortcuts": "Meta+Period Control+Period",
      "data-state": active ? ("on" as const) : ("off" as const),
      onClick: composeHandler<ReactMouseEvent<TElement>>(
        props?.onClick,
        toggle
      ),
    }),
    getLayerProps: <TElement extends HTMLElement = HTMLElement>(props?: {
      readonly ref?: Ref<TElement> | undefined
      readonly onClick?:
        ((event: ReactMouseEvent<TElement>) => void) | undefined
      readonly onKeyDown?:
        ((event: ReactKeyboardEvent<TElement>) => void) | undefined
    }) => ({
      ref: composeRef(props?.ref, layerRef),
      role: mode === "toggle" ? ("dialog" as const) : ("group" as const),
      "aria-modal": mode === "toggle" ? true : undefined,
      "data-slot": "pliant-point-mode",
      "data-mode": mode ?? undefined,
      onClick: composeHandler<ReactMouseEvent<TElement>>(
        props?.onClick,
        leaveOnBackdrop
      ),
      onKeyDown: composeHandler<ReactKeyboardEvent<TElement>>(
        props?.onKeyDown,
        moveFocus
      ),
    }),
  }
}
