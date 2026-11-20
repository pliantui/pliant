"use client"

import * as React from "react"
import { cn } from "cn"
import { SquareDashedMousePointerIcon } from "lucide-react"
import { Slot } from "radix-ui"
import { createPortal } from "react-dom"

import { usePointMode } from "@pliantui/react/ask"

import { Button } from "@/components/ui/button"

/** A node users can point at: its id and the label shown on its outline. */
interface PliantPointTarget {
  id: string
  label: string
}

/**
 * Point mode: users point at the part of the page they want to change
 * instead of picking it from a list. Hold Alt (Option on a Mac), press ⌘. or
 * Ctrl+., or press the toggle, and the targets on the page are outlined with
 * their labels; clicking one, or moving to it with Tab or the arrow keys and
 * pressing Enter, calls `onPick` with its id. Release Alt, press Escape or
 * click anywhere else to leave without picking. Its behaviour comes from
 * `usePointMode`.
 *
 * A target is found on the page by its `data-pliant-id`, so it must be a
 * Pliant node, like a `PliantRegion`. Point mode ignores Alt and the
 * shortcut while focus is in a text field other than the ask panel's prompt
 * or in a listbox or menu, and while a modal dialog is open or the body has
 * `pointer-events: none`, as Radix sets for its modal layers. Safari keeps
 * ⌘. for Stop, and some Linux desktops move the window on Alt+click, so the
 * toggle is the way in that always works, and the only one on touch screens.
 *
 * Started from the toggle or the shortcut, point mode is a modal dialog:
 * the rest of the page, an open ask panel included, is `inert` until it
 * ends, so clicking it leaves point mode. Focus goes back to where it was
 * unless `onPick` moves it, as the ask panel does to its prompt when its
 * target changes.
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
  const { mode, boxes, announcement, pick, getTriggerProps, getLayerProps } =
    usePointMode({
      targets,
      onPick,
      // The labels' `max-w-48`, so they stay on screen.
      labelWidth: 192,
    })
  const id = React.useId()

  return (
    <>
      <Slot.Root {...getTriggerProps()}>
        {trigger ?? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
          >
            <SquareDashedMousePointerIcon />
            Point
          </Button>
        )}
      </Slot.Root>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
      {mode !== null &&
        createPortal(
          <div
            {...getLayerProps()}
            aria-label="Point mode"
            aria-describedby={mode === "toggle" ? `${id}-help` : undefined}
            className="pointer-events-auto fixed inset-0 z-40 cursor-crosshair"
          >
            {mode === "toggle" && (
              <p id={`${id}-help`} className="sr-only">
                Pick a part to change. Use Tab or the arrow keys to move, Enter
                to pick, Escape to leave.
              </p>
            )}
            {boxes.map((box) => (
              <button
                key={box.id}
                type="button"
                data-pliant-point-target={box.id}
                className="absolute cursor-pointer rounded-lg bg-primary/5 shadow-lg ring-2 shadow-primary/25 ring-primary/60 outline-none hover:bg-primary/10 hover:shadow-primary/40 hover:ring-primary focus-visible:bg-primary/10 focus-visible:ring-4 focus-visible:shadow-primary/40 focus-visible:ring-primary motion-safe:animate-in motion-safe:transition-[background-color,box-shadow] motion-safe:fade-in-0"
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
                    "absolute max-w-48 truncate rounded-md bg-primary px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-primary-foreground shadow-sm",
                    box.top < 24 ? "top-1" : "-top-6"
                  )}
                  style={
                    box.labelAlign === "end"
                      ? { right: box.labelInset }
                      : { left: box.labelInset }
                  }
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
