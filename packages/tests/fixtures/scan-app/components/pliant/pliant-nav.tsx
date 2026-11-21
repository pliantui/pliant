"use client"

import * as React from "react"

import { usePliantNodeProps } from "@pliantui/react"
import { usePliantNav } from "@pliantui/react/nav"

function PliantNav({
  id,
  items,
  ...props
}: Omit<React.ComponentProps<"ul">, "id" | "children"> & {
  id: string
  items: Readonly<Record<string, { title: string; url: string }>>
}) {
  const node = usePliantNodeProps(id)
  const nav = usePliantNav(id, items)
  return (
    <ul {...props} {...node}>
      {nav.entries.map((entry) => (
        <li key={entry.id} data-pliant-id={entry.id}>
          <a href={items[entry.id]?.url}>{items[entry.id]?.title}</a>
        </li>
      ))}
    </ul>
  )
}

export { PliantNav }
