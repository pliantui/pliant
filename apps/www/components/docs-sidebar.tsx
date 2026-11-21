"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"
import type { Item, Root } from "fumadocs-core/page-tree"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { getDocsGroups } from "@/lib/docs-nav"

export function DocsSidebar({
  tree,
  ...props
}: React.ComponentProps<typeof Sidebar> & { tree: Root }) {
  const pathname = usePathname()
  const groups = getDocsGroups(tree)

  return (
    <Sidebar
      className="sticky top-[calc(var(--header-height)+0.6rem)] z-30 hidden h-[calc(100svh-10rem)] overflow-hidden overscroll-none bg-transparent [--sidebar-menu-width:--spacing(56)] lg:flex"
      collapsible="none"
      role="navigation"
      aria-label="Docs"
      {...props}
    >
      <div className="absolute top-12 right-2 bottom-0 hidden h-full w-px bg-[linear-gradient(to_bottom,transparent_0%,var(--border)_10%,var(--border)_90%,transparent_100%)] lg:flex" />
      <SidebarContent className="w-(--sidebar-menu-width) scroll-fade scrollbar-none overflow-x-hidden pl-2.5">
        {groups.map((group, index) => (
          <SidebarGroup key={group.id} className={cn(index === 0 && "pt-12")}>
            <SidebarGroupLabel className="font-medium text-muted-foreground">
              {group.name}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.pages.map((page) => (
                  <DocsSidebarLink
                    key={page.url}
                    page={page}
                    isActive={page.url === pathname}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}

function DocsSidebarLink({
  page,
  isActive,
}: {
  page: Item
  isActive: boolean
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className="relative h-[30px] w-fit overflow-visible border border-transparent text-[0.8rem] font-medium after:absolute after:inset-x-0 after:-inset-y-1 after:z-0 after:rounded-md data-[active=true]:border-accent data-[active=true]:bg-accent"
      >
        <Link href={page.url} aria-current={isActive ? "page" : undefined}>
          <span className="absolute inset-0 flex w-(--sidebar-menu-width) bg-transparent" />
          {page.name}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
