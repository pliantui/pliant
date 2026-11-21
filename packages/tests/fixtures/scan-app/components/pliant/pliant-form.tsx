"use client"

import * as React from "react"

import { usePliantNodeProps } from "@pliantui/react"
import { usePliantForm } from "@pliantui/react/form"

function PliantForm({
  id,
  fields,
  ...props
}: Omit<React.ComponentProps<"div">, "id" | "children"> & {
  id: string
  fields: Readonly<Record<string, React.ReactNode>>
}) {
  const node = usePliantNodeProps(id)
  const form = usePliantForm(id, fields)
  return (
    <div {...props} {...node}>
      {form.entries.map((entry) => (
        <div key={entry.id} data-pliant-id={entry.id}>
          {fields[entry.id]}
        </div>
      ))}
    </div>
  )
}

export { PliantForm }
