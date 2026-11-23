"use client"

import * as React from "react"
import { cn } from "cn"
import {
  HistoryIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
} from "lucide-react"

import { usePliantMessages, type PliantMessages } from "@pliantui/react"

import { Button } from "@/components/ui/button"
import { CommandGroup, CommandItem } from "@/components/ui/command"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { CustomizeIcon } from "./customize-icon"

declare module "@pliantui/react" {
  interface PliantMessages {
    customizeOpen: string
    customizeCustomized: string
    customizeAsk: string
    customizeAdjust: string
    customizeHistory: string
    customizeReset: string
  }
}

const customizeMessages = {
  customizeOpen: "Customize",
  customizeCustomized: "Customized",
  customizeAsk: "Ask for a change…",
  customizeAdjust: "Adjust by hand",
  customizeHistory: "History",
  customizeReset: "Reset to default",
} satisfies Partial<PliantMessages>

/**
 * What the Customize items do. An item without a handler is disabled, and
 * shows `unavailable` after its name.
 */
interface PliantCustomizeActions {
  /** Opens a way to ask for a change, such as `PliantAskPanel`. */
  onAsk?: (() => void) | undefined
  /** Opens the controls for changing the part by hand. */
  onAdjust?: (() => void) | undefined
  /** Shows the changes made to the part. */
  onHistory?: (() => void) | undefined
  /** Drops the user's changes, as with `resetNode`. */
  onReset?: (() => void) | undefined
  /** Whether there's anything to reset. Defaults to `true`. */
  canReset?: boolean | undefined
  /** Shown after the name of an item that has no handler. */
  unavailable?: React.ReactNode
}

// ⌘. on a Mac, Ctrl+. elsewhere. `code` finds the key on layouts where "."
// needs Shift.
const askShortcut = { label: "⌘.", keys: "Meta+Period Control+Period" }

function isAskShortcut(event: React.KeyboardEvent) {
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    (event.key === "." || (event.code === "Period" && !event.shiftKey))
  )
}

interface CustomizeItem {
  id: "ask" | "adjust" | "history" | "reset"
  label: string
  icon: React.ReactNode
  run: (() => void) | undefined
  missing: boolean
  // Whether running it moves focus, so the menu mustn't put focus back on
  // its trigger.
  movesFocus: boolean
}

// The items in two groups: asking and adjusting, then history and reset.
function useCustomizeItems({
  onAsk,
  onAdjust,
  onHistory,
  onReset,
  canReset = true,
}: PliantCustomizeActions): CustomizeItem[][] {
  const messages = usePliantMessages(customizeMessages)
  return [
    [
      {
        id: "ask",
        label: messages.customizeAsk,
        icon: <SparklesIcon />,
        run: onAsk,
        missing: onAsk === undefined,
        movesFocus: true,
      },
      {
        id: "adjust",
        label: messages.customizeAdjust,
        icon: <SlidersHorizontalIcon />,
        run: onAdjust,
        missing: onAdjust === undefined,
        movesFocus: true,
      },
    ],
    [
      {
        id: "history",
        label: messages.customizeHistory,
        icon: <HistoryIcon />,
        run: onHistory,
        missing: onHistory === undefined,
        movesFocus: true,
      },
      {
        id: "reset",
        label: messages.customizeReset,
        icon: <RotateCcwIcon />,
        run: canReset ? onReset : undefined,
        missing: onReset === undefined,
        movesFocus: false,
      },
    ],
  ]
}

// Runs an item that moves focus once its menu has closed, so the menu
// doesn't take focus back or drop it as it goes. Other items run at once,
// and focus goes back to the menu's trigger.
function useRunAfterClose() {
  const pending = React.useRef<(() => void) | null>(null)
  return {
    run: (item: Pick<CustomizeItem, "run" | "movesFocus">) => {
      if (item.movesFocus) pending.current = item.run ?? null
      else item.run?.()
    },
    onCloseAutoFocus: (event: Event) => {
      const run = pending.current
      pending.current = null
      if (!run) return
      event.preventDefault()
      run()
    },
  }
}

function splitActions<T extends PliantCustomizeActions>({
  onAsk,
  onAdjust,
  onHistory,
  onReset,
  canReset,
  unavailable,
  ...rest
}: T) {
  return {
    actions: { onAsk, onAdjust, onHistory, onReset, canReset, unavailable },
    rest,
  }
}

/**
 * The Customize button and its menu: Ask for a change and Adjust by hand,
 * then History and Reset to default. It's where a part of the app offers its
 * Pliant actions, so they need no buttons of their own. While `customized`
 * is set, a quiet "Customized" mark shows beside it.
 *
 * Reset to default puts focus back on the button. The other items leave
 * focus where their handler moved it, such as on the ask panel's prompt.
 */
function PliantCustomizeMenu(
  props: Omit<React.ComponentProps<typeof Button>, "children"> &
    PliantCustomizeActions & {
      /** Whether the user has changed the part. */
      customized?: boolean
      /** The element that opens the menu. Defaults to a Customize button. */
      trigger?: React.ReactElement
      /** How the menu lines up with its trigger. Defaults to `"end"`. */
      align?: "start" | "center" | "end"
    }
) {
  const {
    actions,
    rest: { customized = false, trigger, align = "end", className, ...button },
  } = splitActions(props)
  const messages = usePliantMessages(customizeMessages)
  const groups = useCustomizeItems(actions)
  const focus = useRunAfterClose()

  return (
    <div
      data-slot="pliant-customize-menu"
      className="flex shrink-0 items-center gap-2"
    >
      {customized && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-primary"
          />
          {messages.customizeCustomized}
        </span>
      )}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          {trigger ?? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("data-[state=open]:bg-accent", className)}
              {...button}
            >
              <CustomizeIcon />
              {messages.customizeOpen}
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align}
          className="w-52"
          onCloseAutoFocus={focus.onCloseAutoFocus}
        >
          {groups.map((group, index) => (
            <React.Fragment key={group[0]?.id}>
              {index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuGroup>
                {group.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    disabled={!item.run}
                    onSelect={() => {
                      focus.run(item)
                    }}
                  >
                    {item.icon}
                    {item.label}
                    {item.missing && actions.unavailable}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/**
 * The Customize group for a `ContextMenuContent` of your own, as when a part
 * already has a right-click menu. An item that moves focus, like Ask, should
 * run once the menu has closed, from `runItem` and the menu's
 * `onCloseAutoFocus`; `PliantCustomizeContextMenu` does this for you.
 */
function PliantCustomizeContextMenuGroup({
  runItem,
  ...actions
}: PliantCustomizeActions & {
  /**
   * Runs a picked item's handler, in place of running it at once, as to
   * wait for the menu to close.
   */
  runItem?:
    | ((item: { run: (() => void) | undefined; movesFocus: boolean }) => void)
    | undefined
}) {
  const messages = usePliantMessages(customizeMessages)
  const groups = useCustomizeItems(actions)

  return (
    <ContextMenuGroup>
      <ContextMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
        <CustomizeIcon className="size-3.5" />
        {messages.customizeOpen}
      </ContextMenuLabel>
      {groups.map((group, index) => (
        <React.Fragment key={group[0]?.id}>
          {index > 0 && <ContextMenuSeparator />}
          {group.map((item) => (
            <ContextMenuItem
              key={item.id}
              disabled={!item.run}
              aria-keyshortcuts={
                item.id === "ask" && item.run ? askShortcut.keys : undefined
              }
              onSelect={() => {
                if (runItem) runItem(item)
                else item.run?.()
              }}
            >
              {item.icon}
              {item.label}
              {item.missing && actions.unavailable}
              {item.id === "ask" && item.run && (
                <ContextMenuShortcut aria-hidden="true">
                  {askShortcut.label}
                </ContextMenuShortcut>
              )}
            </ContextMenuItem>
          ))}
        </React.Fragment>
      ))}
    </ContextMenuGroup>
  )
}

/**
 * Adds the Customize group to the right-click menu, or long-press menu on a
 * touch screen, of `children`: one element, such as a region or a table.
 * While focus is inside it, ⌘. (Ctrl+. outside a Mac) runs `onAsk`.
 */
function PliantCustomizeContextMenu({
  children,
  ...actions
}: PliantCustomizeActions & {
  children: React.ReactElement
}) {
  const focus = useRunAfterClose()
  const { onAsk } = actions

  return (
    <ContextMenu modal={false}>
      <ContextMenuTrigger
        asChild
        onKeyDown={(event) => {
          if (
            !onAsk ||
            event.defaultPrevented ||
            event.nativeEvent.isComposing ||
            !isAskShortcut(event)
          ) {
            return
          }
          event.preventDefault()
          onAsk()
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent
        className="w-52"
        onCloseAutoFocus={focus.onCloseAutoFocus}
      >
        <PliantCustomizeContextMenuGroup {...actions} runItem={focus.run} />
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * The Customize group for a command menu built on shadcn's `Command`, such
 * as the app's ⌘K menu. Close the menu in the handlers before moving focus.
 */
function PliantCustomizeCommandGroup({
  heading,
  className,
  ...actions
}: PliantCustomizeActions & {
  /** The group's heading. Defaults to `customizeOpen`, "Customize". */
  heading?: string
  className?: string
}) {
  const messages = usePliantMessages(customizeMessages)
  const groups = useCustomizeItems(actions)

  return (
    <CommandGroup
      heading={heading ?? messages.customizeOpen}
      className={className}
    >
      {groups.flat().map((item) => (
        <CommandItem
          key={item.id}
          value={`${heading ?? messages.customizeOpen} ${item.label}`}
          disabled={!item.run}
          onSelect={() => item.run?.()}
        >
          {item.icon}
          {item.label}
          {item.missing && actions.unavailable}
        </CommandItem>
      ))}
    </CommandGroup>
  )
}

export {
  PliantCustomizeCommandGroup,
  PliantCustomizeContextMenu,
  PliantCustomizeContextMenuGroup,
  PliantCustomizeMenu,
  type PliantCustomizeActions,
}
