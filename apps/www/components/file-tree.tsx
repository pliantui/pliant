"use client"

import * as React from "react"
import { cn } from "cn"
import { ChevronRightIcon, FileIcon, FolderIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

export function FileTree({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-not-typeset
      className={cn(
        "mt-6 flex flex-col rounded-2xl border p-2 text-sm md:-mx-1",
        className
      )}
      {...props}
    />
  )
}

export function Folder({
  name,
  defaultOpen = true,
  children,
}: {
  name: string
  defaultOpen?: boolean
  children?: React.ReactNode
}) {
  return (
    <li>
      <Collapsible defaultOpen={defaultOpen} className="group/folder">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start font-normal"
          >
            <ChevronRightIcon
              aria-hidden="true"
              className="transition-transform group-data-[state=open]/folder:rotate-90"
            />
            <FolderIcon aria-hidden="true" />
            {name}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent asChild>
          <ul className="ml-4 flex flex-col">{children}</ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  )
}

export function File({ name }: { name: string }) {
  return (
    <li className="flex h-8 items-center gap-1.5 px-2.5">
      <span className="size-4 shrink-0" aria-hidden="true" />
      <FileIcon aria-hidden="true" className="size-4 shrink-0" />
      {name}
    </li>
  )
}
