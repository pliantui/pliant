"use client"

import * as React from "react"
import { cn } from "cn"
import { ChevronDownIcon } from "lucide-react"

import {
  usePliantMessages,
  usePliantNodeProps,
  type PliantMessages,
} from "@pliantui/react"
import { usePliantForm, type PliantFormSchema } from "@pliantui/react/form"
import {
  PliantActivity,
  useRegionItems,
  type RegionItem,
} from "@pliantui/react/region"

import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"

declare module "@pliantui/react" {
  interface PliantMessages {
    formMoreFields: string
  }
}

const formMessages = {
  formMoreFields: "More fields",
} satisfies Partial<PliantMessages>

function MoreFieldsTrigger({
  item,
}: {
  item: Extract<RegionItem, { kind: "trigger" }>
}) {
  const messages = usePliantMessages(formMessages)
  return (
    <Button
      {...item.getTriggerProps()}
      variant="ghost"
      size="sm"
      className="-ml-2.5 self-start"
    >
      {item.label ?? messages.formMoreFields}
      <ChevronDownIcon
        className={cn("transition-transform", item.open && "rotate-180")}
      />
    </Button>
  )
}

function FormFields({
  entries,
  fields,
}: {
  entries: ReturnType<typeof usePliantForm>["entries"]
  fields: Readonly<Record<string, React.ReactNode>>
}) {
  return useRegionItems(entries).map((item) =>
    item.kind === "trigger" ? (
      <MoreFieldsTrigger key={item.key} item={item} />
    ) : (
      // A closed "More fields" section only hides its fields: unlike a
      // hidden activity, it keeps their effects running, so a form library
      // still validates them and marks them invalid, which opens it on
      // submit.
      <PliantActivity
        key={item.key}
        mode={item.entry.visible ? "visible" : "hidden"}
      >
        <div
          {...item.props}
          style={{ display: item.mode === "hidden" ? "none" : "contents" }}
        >
          {fields[item.entry.id]}
        </div>
      </PliantActivity>
    )
  )
}

/**
 * The fields of a form, which users can reorder, hide and collapse into a
 * "More fields" section with overlays. Render it inside your `<form>` in
 * place of `FieldGroup`. Each field is rendered inside a `display: contents`
 * wrapper with `data-pliant-id`, always in this same element, so hiding,
 * moving or collapsing a field never remounts it: it keeps its state and
 * its value. A collapsed section opens when the form's `submit` event finds
 * a field inside invalid, and focus moves to the first invalid field. Submit
 * through the `<form>`, as a submit button or `form.requestSubmit()` for
 * autosave does: calling the form library's submit handler from a button
 * outside a `<form>` doesn't open it.
 */
function PliantForm({
  id,
  fields,
  schema,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "id" | "children"> & {
  /** The form's node id: kebab-case, unique within the surface. */
  id: string
  /**
   * Each field by its name in your form library, such as a `Controller` or
   * a `form.Field`. The key order is the base order.
   */
  fields: Readonly<Record<string, React.ReactNode>>
  /**
   * The form's schema, such as the Zod object your resolver validates with.
   * Fields it requires can't be hidden or collapsed: mark a field
   * `.optional()` or give it a `.default()` to let users hide it.
   */
  schema?: PliantFormSchema
}) {
  const node = usePliantNodeProps(id)
  const form = usePliantForm(id, fields, { schema })
  return (
    <FieldGroup
      {...props}
      data-slot="pliant-form"
      {...node}
      className={className}
    >
      <FormFields entries={form.entries} fields={fields} />
    </FieldGroup>
  )
}

export { PliantForm }
