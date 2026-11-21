import {
  useEffectEvent,
  useId,
  useLayoutEffect,
  useState,
  type MouseEvent,
} from "react"
import { flushSync } from "react-dom"

import type { RegionEntry } from "@pliantui/core"

type Collapse = NonNullable<RegionEntry["collapsed"]>

const invalid = '[aria-invalid="true"]'

type ClickHandler = (event: MouseEvent<HTMLButtonElement>) => void

interface RegionTriggerProps {
  readonly id: string
  readonly type: "button"
  readonly "aria-expanded": boolean
  readonly "aria-controls": string
  readonly "data-pliant-collapse": Collapse["into"]
  readonly onClick: ClickHandler
}

/**
 * What a list of region entries renders, from `useRegionItems`: an entry,
 * or the trigger of a collapse that holds the entries after it.
 *
 * @experimental
 */
export type RegionItem =
  | {
      readonly kind: "entry"
      /** The item's React key. */
      readonly key: string
      readonly entry: RegionEntry
      /** The key of the collapse that holds the entry, if one does. */
      readonly group: string | undefined
      /**
       * `hidden` when the entry is hidden or its collapse is closed. Pass it
       * to `PliantActivity`, so the entry keeps its state.
       */
      readonly mode: "visible" | "hidden"
      /** Props for the entry's wrapper element. */
      readonly props: {
        readonly id: string
        readonly "data-pliant-id": string
        readonly "data-pliant-pinned": RegionEntry["pinned"]
      }
    }
  | {
      readonly kind: "trigger"
      /** The item's React key. */
      readonly key: string
      /** The collapse's key, the `group` of the entries it holds. Treat it as opaque. */
      readonly group: string
      readonly into: Collapse["into"]
      readonly label: string | undefined
      readonly open: boolean
      /** The keys of the entry items the collapse holds, in order. */
      readonly members: readonly string[]
      /**
       * Props for the button that opens and closes the collapse. Pass your
       * own `onClick` here rather than after the spread: it runs first, and
       * the collapse toggles unless it calls `event.preventDefault()`.
       */
      readonly getTriggerProps: (props?: {
        readonly onClick?: ClickHandler | undefined
      }) => RegionTriggerProps
    }

interface CollapseGroup {
  readonly kind: "collapse"
  readonly key: string
  readonly collapse: Collapse
  readonly entries: RegionEntry[]
}

// Collapsed entries follow a trigger at the place of the first one, as
// siblings of the other entries: moving them into a disclosure element would
// remount them, losing their state. An entry between two collapsed ones comes
// after the group.
function groupsOf(entries: readonly RegionEntry[]) {
  const parts: (RegionEntry | CollapseGroup)[] = []
  const groups = new Map<string, CollapseGroup>()
  for (const entry of entries) {
    if (!entry.collapsed) {
      parts.push(entry)
      continue
    }
    const key = `${entry.collapsed.into}:${entry.collapsed.label ?? ""}`
    let group = groups.get(key)
    if (!group) {
      group = { kind: "collapse", key, collapse: entry.collapsed, entries: [] }
      groups.set(key, group)
      parts.push(group)
    }
    group.entries.push(entry)
  }
  return parts
}

/**
 * The items to render for a list of region entries: the region's, from
 * `usePliantRegion`, or a wrapper's. Each entry keeps its key, and the
 * entries a `collapse` holds follow a trigger in the same parent, so opening
 * and closing them never remounts them. Holds which collapses are open, and
 * moves focus to the trigger when an op collapses the focused entry.
 *
 * A closed collapse opens when the `submit` event of its form finds a
 * control inside invalid: one with `aria-invalid="true"`, as form libraries
 * set it once their validation settles, and focus then moves to the form's
 * first invalid control unless an invalid control has focus. It also opens
 * when the browser's validation fires `invalid` on a control inside, before
 * the browser focuses it. Only a `submit` event counts: a button that runs a
 * form library's submit handler without a `<form>` doesn't open it, and
 * autosave that calls `form.requestSubmit()` does. A control that becomes
 * invalid while the user types or clicks, as with validation on change,
 * leaves the collapse and focus as they are. The user can close it again
 * while a control inside is invalid, and the next submit opens it again.
 *
 * @experimental
 */
export function useRegionItems(
  entries: readonly RegionEntry[]
): readonly RegionItem[] {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const baseId = useId()
  const items: RegionItem[] = []

  function toggle(group: string) {
    setOpen((current) => {
      const next = new Set(current)
      return next.delete(group) ? next : next.add(group)
    })
  }

  const closed: (readonly [string, string, string])[] = []

  function entryItem(
    entry: RegionEntry,
    group: string | undefined,
    hidden: boolean
  ) {
    return {
      kind: "entry",
      key: entry.id,
      entry,
      group,
      mode: entry.visible && !hidden ? "visible" : "hidden",
      props: {
        id: `${baseId}${entry.id}`,
        "data-pliant-id": entry.id,
        "data-pliant-pinned": entry.pinned,
      },
    } satisfies RegionItem
  }

  for (const part of groupsOf(entries)) {
    if (part.kind !== "collapse") {
      items.push(entryItem(part, undefined, false))
      continue
    }
    const isOpen = open.has(part.key)
    const id = `${baseId}collapse-${encodeURIComponent(part.key)}`
    const members = part.entries.map((entry) =>
      entryItem(entry, part.key, !isOpen)
    )
    if (part.entries.some((entry) => entry.visible)) {
      items.push({
        kind: "trigger",
        key: `collapse:${part.key}`,
        group: part.key,
        into: part.collapse.into,
        label: part.collapse.label,
        open: isOpen,
        members: members.map((member) => member.key),
        getTriggerProps: (props) => ({
          id,
          type: "button",
          "aria-expanded": isOpen,
          "aria-controls": members.map((member) => member.props.id).join(" "),
          "data-pliant-collapse": part.collapse.into,
          onClick: (event) => {
            props?.onClick?.(event)
            if (!event.defaultPrevented) {
              toggle(part.key)
            }
          },
        }),
      })
    }
    items.push(...members)
    if (!isOpen) {
      closed.push(
        ...members.map((member) => [member.props.id, id, part.key] as const)
      )
    }
  }

  const closedKey = JSON.stringify(closed)

  // Focus would be lost in an entry an op just collapsed, so it moves to the
  // entry's trigger.
  const watchClosed = useEffectEvent(() => {
    for (const [entryId, triggerId] of closed) {
      if (document.getElementById(entryId)?.contains(document.activeElement)) {
        document.getElementById(triggerId)?.focus()
        break
      }
    }
  })

  useLayoutEffect(() => {
    watchClosed()
  }, [closedKey])

  const reveal = useEffectEvent((scope: Element, form?: boolean) => {
    const groups = closed
      .filter(([entryId]) => {
        const element = document.getElementById(entryId)
        return form
          ? scope.contains(element) && element?.querySelector(invalid)
          : element?.contains(scope)
      })
      .map(([, , group]) => group)
    if (groups.length) {
      flushSync(() => {
        setOpen((current) => new Set([...current, ...groups]))
      })
      if (form && !document.activeElement?.matches(invalid)) {
        scope.querySelector<HTMLElement>(invalid)?.focus()
      }
    }
  })

  // A collapse opens when a submit finds a control inside invalid, so the
  // user sees the error, even one the user closed while the control was
  // invalid. The browser's own validation fires `invalid` on the control,
  // and the collapse opens synchronously, since the browser focuses the
  // control right after the event. A form library marks the control with
  // `aria-invalid` once its validation settles, so the collapses of the
  // submitted form open when an `aria-invalid` changes, or a task after the
  // submit if none does. A form library tried to focus the first invalid
  // control while it was hidden, so unless an invalid control has focus,
  // focus moves to the form's first invalid control. A control can also
  // become invalid as the user types elsewhere, when a form validates on
  // change: opening the collapse and moving focus then would change the
  // context under the user, so only a submit, until the user's next input,
  // opens it.
  useLayoutEffect(() => {
    let submitted: Element | null = null
    const types = ["invalid", "submit", "input", "keydown", "click"]
    const settle = () => {
      if (submitted) {
        reveal(submitted, true)
      }
    }
    const track = (event: Event) => {
      if (!(event.target instanceof Element)) {
        return
      }
      if (event.type === "invalid") {
        reveal(event.target)
      } else {
        submitted = event.type === "submit" ? event.target : null
        if (submitted) {
          setTimeout(settle)
        }
      }
    }
    const observer = new MutationObserver(settle)
    observer.observe(document, {
      subtree: true,
      attributeFilter: ["aria-invalid"],
    })
    for (const type of types) {
      document.addEventListener(type, track, true)
    }
    return () => {
      submitted = null
      observer.disconnect()
      for (const type of types) {
        document.removeEventListener(type, track, true)
      }
    }
  }, [])

  return items
}
