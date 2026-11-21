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
 * moves focus to the trigger when an op collapses the focused entry. A
 * closed collapse opens when a control inside becomes invalid: when it gets
 * `aria-invalid="true"`, as form libraries set it, and focus moves to it
 * unless an invalid control has focus; or when the browser's validation
 * fires `invalid` on it, before the browser focuses it. The user can close
 * it again while the control is invalid.
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
  //
  // A collapse opens when a control inside becomes invalid, so the user sees
  // the error: a form library marks it with `aria-invalid`, and the
  // browser's own validation fires `invalid` on it. It opens synchronously,
  // since the browser focuses the invalid control right after the event.
  // A form library tried to focus the first invalid control while it was
  // hidden, so unless an invalid control has focus, focus moves to the
  // invalid control in the collapse that opens.
  const watchClosed = useEffectEvent(() => {
    for (const [entryId, triggerId] of closed) {
      if (document.getElementById(entryId)?.contains(document.activeElement)) {
        document.getElementById(triggerId)?.focus()
        break
      }
    }
    return closed.map(([entryId, , group]) => {
      const element = document.getElementById(entryId)
      const openGroup = () => {
        flushSync(() => {
          setOpen((current) => new Set(current).add(group))
        })
      }
      const observer = new MutationObserver(() => {
        const control = element?.querySelector<HTMLElement>(invalid)
        if (control) {
          openGroup()
          if (!document.activeElement?.matches(invalid)) {
            control.focus()
          }
        }
      })
      if (element) {
        element.addEventListener("invalid", openGroup, true)
        observer.observe(element, {
          subtree: true,
          attributeFilter: ["aria-invalid"],
        })
      }
      return () => {
        element?.removeEventListener("invalid", openGroup, true)
        observer.disconnect()
      }
    })
  })

  useLayoutEffect(() => {
    const cleanups = watchClosed()
    return () => {
      for (const cleanup of cleanups) {
        cleanup()
      }
    }
  }, [closedKey])

  return items
}
