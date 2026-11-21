"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import type { Root } from "fumadocs-core/page-tree"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { getDocsGroups, getDocsSections } from "@/lib/docs-nav"
import type { NavItem } from "@/lib/nav"

export function MobileNav({
  tree,
  items,
  className,
}: {
  tree: Root
  items: readonly NavItem[]
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const close = () => {
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "extend-touch-target h-8 touch-manipulation items-center justify-start gap-2.5 p-0! hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 active:bg-transparent dark:hover:bg-transparent",
            className
          )}
        >
          <div
            className="relative flex h-8 w-4 items-center justify-center"
            aria-hidden="true"
          >
            <div className="relative size-4">
              <span
                className={cn(
                  "absolute left-0 block h-0.5 w-4 bg-foreground transition-all duration-100",
                  open ? "top-[0.4rem] -rotate-45" : "top-1"
                )}
              />
              <span
                className={cn(
                  "absolute left-0 block h-0.5 w-4 bg-foreground transition-all duration-100",
                  open ? "top-[0.4rem] rotate-45" : "top-2.5"
                )}
              />
            </div>
          </div>
          <span className="flex h-8 items-center text-lg leading-none font-medium">
            Menu
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-label="Menu"
        className="no-scrollbar h-(--radix-popper-available-height) w-(--radix-popper-available-width) overflow-y-auto rounded-none border-none bg-background/90 p-0 shadow-none backdrop-blur duration-100 data-[state=open]:animate-none!"
        align="start"
        side="bottom"
        alignOffset={-16}
        sideOffset={14}
      >
        <div className="flex flex-col gap-12 overflow-auto px-6 py-6">
          <MobileGroup label="Menu">
            {items.map((item) => (
              <MobileLink key={item.href} href={item.href} onNavigate={close}>
                {item.label}
              </MobileLink>
            ))}
          </MobileGroup>
          <MobileGroup label="Sections">
            {getDocsSections(tree).map((page) => (
              <MobileLink key={page.url} href={page.url} onNavigate={close}>
                {page.name}
              </MobileLink>
            ))}
          </MobileGroup>
          <div className="flex flex-col gap-8">
            {getDocsGroups(tree).map((group) => (
              <MobileGroup key={group.id} label={group.name}>
                {group.pages.map((page) => (
                  <MobileLink key={page.url} href={page.url} onNavigate={close}>
                    {page.name}
                  </MobileLink>
                ))}
              </MobileGroup>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function MobileGroup({
  label,
  children,
}: {
  label: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

function MobileLink({
  href,
  onNavigate,
  children,
}: {
  href: string
  onNavigate: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-2 text-2xl font-medium"
    >
      {children}
    </Link>
  )
}
