import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type Ref,
} from "react"

import type { Op } from "@pliantui/contract"

import { composeHandler, composeRef } from "./compose-props"
import { revealTarget } from "./reveal-target"
import { usePliantStatus } from "./use-pliant-status"
import { usePliantStore } from "./use-pliant-store"
import { usePliantSurface } from "./use-pliant-surface"
import { usePreview } from "./use-preview"

type AskAnswer =
  | { readonly status: "ok"; readonly overlay: unknown }
  | { readonly status: "clarify"; readonly question: string }
  | { readonly status: "unavailable"; readonly reason: string }
  | { readonly status: "error"; readonly message: string }

// Bundlers replace `process.env.NODE_ENV`; where none did and there is no
// `process`, this is a browser build that isn't development.
function logInDevelopment(error: unknown) {
  try {
    if (process.env.NODE_ENV === "production") {
      return
    }
  } catch {
    return
  }
  console.error(error)
}

/**
 * Where an ask stands: nothing yet, in progress, answered with a question,
 * a failure or a reason it can't be done, cancelled, or the preview
 * discarded or locked in, with the ops that stayed in the session layer.
 *
 * @experimental
 */
export type AskPanelState =
  | { status: "idle" }
  | { status: "asking" }
  | { status: "clarify"; question: string }
  | { status: "failed"; message: string }
  | { status: "unavailable"; reason: string }
  | { status: "cancelled" }
  | { status: "discarded" }
  | { status: "locked"; keptInSession: readonly Op[] }

/** @experimental */
export interface UseAskPanelOptions<TTarget extends { readonly id: string }> {
  /** The nodes users can ask about. */
  targets: readonly TTarget[]
  /** The id of the picked target, when the parent controls it. */
  target?: string | undefined
  /** The id of the target picked first. Defaults to the first target. */
  defaultTarget?: string | undefined
  /**
   * Called with the id of the target the user picks in the picker. A
   * controlled parent applies it by passing it back as `target`, right away
   * or later, as after a navigation, and focus stays on the picker.
   */
  onTargetChange?: ((target: string) => void) | undefined
  /** Whether the panel is open, when the parent controls it. */
  open?: boolean | undefined
  /** Whether the panel starts open. It doesn't take focus then. */
  defaultOpen?: boolean | undefined
  /** Called when the trigger, Escape or `setOpen` opens or closes it. */
  onOpenChange?: ((open: boolean) => void) | undefined
  /**
   * Sends an ask to the server and resolves with its answer, as
   * `createPliantHandler` in `@pliantui/server` sends it. It is aborted
   * through `signal` when the ask is cancelled. If it throws, the state says
   * the server couldn't be reached, and in development the error is logged.
   */
  send: (
    ask: { surface: string; target: TTarget; prompt: string },
    signal: AbortSignal
  ) => Promise<AskAnswer>
}

/**
 * The state and behaviour of a panel for asking AI to change a node of the
 * page: whether it is open, which target and prompt are picked, and where
 * the ask stands. The answer is previewed on the page, as `usePreview`
 * shows, and only saved by `lockIn`. Use it inside a `PliantRoot`; `send`
 * gets the root's surface with each ask, and how the ask reaches the server
 * is up to it.
 *
 * Spread `getTriggerProps()` on the element that opens the panel,
 * `getPanelProps()` on the panel, `getPromptProps()` on its textarea, and
 * `getPickerProps()` on the element that has focus while users pick a
 * target, which then calls `setTarget`. Pass your own handlers and ref to
 * the getters rather than after the spread: a handler runs first, and the
 * panel skips its own when it calls `event.preventDefault()`.
 *
 * Enter in the prompt sends and Shift+Enter adds a new line. Escape closes
 * the panel while focus is inside it, and focus then goes back to the
 * trigger. Focus moves to the prompt when the panel opens and when the
 * parent changes `target` while it is open, but not when a pick of
 * `setTarget` comes back as `target`, right away or later. Changing the
 * target, from anywhere, and closing the panel cancel an ask in progress;
 * closing keeps the preview. A target that isn't one of `targets` falls
 * back to the first. The prompt is kept when the target changes, so the
 * same ask can go to another target.
 *
 * When a preview shows and the panel covers its target, found by its
 * `data-pliant-id`, from below, the target is scrolled to the top of the
 * viewport.
 *
 * @experimental
 */
export function useAskPanel<TTarget extends { readonly id: string }>({
  targets,
  target: targetProp,
  defaultTarget,
  onTargetChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  send,
}: UseAskPanelOptions<TTarget>) {
  const store = usePliantStore()
  const surface = usePliantSurface()
  const ready = usePliantStatus().status === "ready"
  const preview = usePreview()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const [uncontrolledTarget, setUncontrolledTarget] = useState(defaultTarget)
  const [prompt, setPromptText] = useState("")
  const [state, setState] = useState<AskPanelState>({ status: "idle" })
  const request = useRef<AbortController | null>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const triggerRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const panelId = useId()
  const open = openProp ?? uncontrolledOpen
  const [focusRequest, setFocusRequest] = useState(0)
  const targetId = targetProp ?? uncontrolledTarget
  const target =
    targets.find((candidate) => candidate.id === targetId) ?? targets[0]

  // An answer for one target must never be previewed under another, and a
  // passive effect would leave a gap for one to land in after the target
  // changed outside an event, from a timer or a transition.
  useLayoutEffect(
    () => () => {
      if (request.current) {
        request.current.abort()
        request.current = null
        setState({ status: "cancelled" })
      }
    },
    [target?.id]
  )

  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) {
      setFocusRequest((count) => count + 1)
    } else if (state.status === "asking") {
      setState({ status: "cancelled" })
    }
  }

  const [seenTarget, setSeenTarget] = useState(target?.id)
  if (seenTarget !== target?.id) {
    setSeenTarget(target?.id)
    if (state.status !== "asking") {
      setState({ status: "idle" })
    }
  }

  // The target the picker last set, to tell the parent's own changes apart.
  // A parent may apply the pick later, so it is kept until `target` changes
  // or focus leaves the picker, as it does when pointing at the page; a pick
  // the parent rejected must not hide a later change of its own.
  const [pickerTarget, setPickerTarget] = useState<string>()
  const [seenTargetProp, setSeenTargetProp] = useState(targetProp)
  if (seenTargetProp !== targetProp) {
    setSeenTargetProp(targetProp)
    setPickerTarget(undefined)
    if (open && targetProp !== pickerTarget) {
      setFocusRequest((count) => count + 1)
    }
  }

  useLayoutEffect(() => {
    if (!open) {
      request.current?.abort()
      request.current = null
    }
  }, [open])

  useEffect(() => {
    if (focusRequest > 0) {
      promptRef.current?.focus()
    }
  }, [focusRequest])

  const asking = state.status === "asking"

  function setOpen(next: boolean) {
    const hadFocus = panelRef.current?.contains(document.activeElement)
    if (openProp === undefined) {
      setUncontrolledOpen(next)
    }
    onOpenChange?.(next)
    if (!next && hadFocus) {
      triggerRef.current?.focus()
    }
  }

  function setTarget(next: string) {
    setPickerTarget(next)
    if (targetProp === undefined) {
      setUncontrolledTarget(next)
    }
    onTargetChange?.(next)
    setState({ status: "idle" })
  }

  function setPrompt(text: string) {
    setPromptText(text)
    promptRef.current?.focus()
  }

  async function submit() {
    const text = prompt.trim()
    if (request.current || !target || text === "") {
      return
    }
    if (!ready) {
      setState({
        status: "failed",
        message: "The page is still loading. Try again in a moment.",
      })
      return
    }
    const controller = new AbortController()
    request.current = controller
    setState({ status: "asking" })
    let answer: AskAnswer
    try {
      answer = await send({ surface, target, prompt: text }, controller.signal)
    } catch (error) {
      if (!controller.signal.aborted) {
        logInDevelopment(error)
      }
      answer = {
        status: "error",
        message: "Couldn't reach the server. Check your connection.",
      }
    }
    if (controller.signal.aborted) {
      return
    }
    request.current = null
    if (answer.status === "ok") {
      const result = store.preview(answer.overlay)
      if (result.success) {
        revealTarget(target.id, panelRef.current)
      }
      setState(
        result.success
          ? { status: "idle" }
          : {
              status: "failed",
              message: `The answer couldn't be previewed: ${result.error}`,
            }
      )
    } else if (answer.status === "clarify") {
      setState({ status: "clarify", question: answer.question })
    } else if (answer.status === "unavailable") {
      setState({ status: "unavailable", reason: answer.reason })
    } else {
      setState({ status: "failed", message: answer.message })
    }
  }

  function ask() {
    void submit()
  }

  function cancel() {
    request.current?.abort()
    request.current = null
    setState({ status: "cancelled" })
    promptRef.current?.focus()
  }

  function lockIn() {
    const result = store.lockIn()
    setState(
      result.success
        ? { status: "locked", keptInSession: result.keptInSession }
        : { status: "failed", message: result.error }
    )
    promptRef.current?.focus()
  }

  function discard() {
    store.discard()
    setState({ status: "discarded" })
    promptRef.current?.focus()
  }

  return {
    open,
    target,
    state,
    prompt,
    setOpen,
    setTarget,
    setPrompt,
    ask,
    cancel,
    lockIn,
    discard,
    getTriggerProps: (props?: {
      readonly ref?: Ref<HTMLElement> | undefined
      readonly onClick?: ((event: MouseEvent<HTMLElement>) => void) | undefined
    }) => ({
      ref: composeRef(props?.ref, triggerRef),
      "aria-expanded": open,
      "aria-controls": open ? panelId : undefined,
      "data-state": open ? ("open" as const) : ("closed" as const),
      "data-preview": preview !== null ? "" : undefined,
      onClick: composeHandler(props?.onClick, () => {
        setOpen(!open)
      }),
    }),
    getPanelProps: (props?: {
      readonly ref?: Ref<HTMLElement> | undefined
      readonly onKeyDown?:
        ((event: KeyboardEvent<HTMLElement>) => void) | undefined
    }) => ({
      ref: composeRef(props?.ref, panelRef),
      id: panelId,
      "data-slot": "pliant-ask-panel",
      "data-state": "open" as const,
      onKeyDown: composeHandler(
        props?.onKeyDown,
        (event: KeyboardEvent<HTMLElement>) => {
          if (
            event.key === "Escape" &&
            !event.nativeEvent.isComposing &&
            event.target instanceof Node &&
            event.currentTarget.contains(event.target)
          ) {
            event.preventDefault()
            setOpen(false)
          }
        }
      ),
    }),
    getPickerProps: (props?: {
      readonly onBlur?: ((event: FocusEvent<HTMLElement>) => void) | undefined
    }) => ({
      onBlur: composeHandler(props?.onBlur, () => {
        setPickerTarget(undefined)
      }),
    }),
    getPromptProps: (props?: {
      readonly ref?: Ref<HTMLTextAreaElement> | undefined
      readonly onChange?:
        ((event: ChangeEvent<HTMLTextAreaElement>) => void) | undefined
      readonly onKeyDown?:
        ((event: KeyboardEvent<HTMLTextAreaElement>) => void) | undefined
    }) => ({
      ref: composeRef(props?.ref, promptRef),
      value: prompt,
      readOnly: asking,
      onChange: composeHandler(
        props?.onChange,
        (event: ChangeEvent<HTMLTextAreaElement>) => {
          setPromptText(event.target.value)
        }
      ),
      onKeyDown: composeHandler(
        props?.onKeyDown,
        (event: KeyboardEvent<HTMLTextAreaElement>) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing &&
            // Safari ends a composition with an Enter whose isComposing is
            // false; only its keyCode tells.
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            event.keyCode !== 229
          ) {
            event.preventDefault()
            ask()
          }
        }
      ),
    }),
  }
}
