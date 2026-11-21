"use client"

import * as React from "react"
import { cn } from "cn"
import { ChevronDownIcon, HouseIcon, MoreHorizontalIcon } from "lucide-react"

import {
  usePliantMessages,
  usePliantNodeProps,
  type PliantMessages,
} from "@pliantui/react"
import {
  usePliantNav,
  usePliantNavOpen,
  type PliantNav as ResolvedNav,
} from "@pliantui/react/nav"
import { useRegionItems, type RegionItem } from "@pliantui/react/region"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar"

declare module "@pliantui/react" {
  interface PliantMessages {
    navMore: string
    navItemOptions: (title: string) => string
    navStartPage: string
  }
}

const navMessages = {
  navMore: "More",
  navItemOptions: (title) => `${title} options`,
  navStartPage: "Start page",
} satisfies Partial<PliantMessages>

/** A link in the nav, as shadcn's sidebar blocks describe one. */
interface PliantNavItem {
  title: string
  url: string
  /** An icon element, such as `<InboxIcon />`. */
  icon?: React.ReactNode
  /** Whether the item is the current page, marked with `aria-current`. */
  isActive?: boolean
}

function NavItemOptions({
  id,
  title,
  nav,
}: {
  id: string
  title: string
  nav: ResolvedNav
}) {
  const { isMobile } = useSidebar()
  const messages = usePliantMessages(navMessages)
  const landing = nav.landing === id
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* 24px rather than shadcn's 20px, the minimum target size. */}
        <SidebarMenuAction showOnHover className="top-1 w-6">
          <MoreHorizontalIcon />
          <span className="sr-only">{messages.navItemOptions(title)}</span>
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-48 rounded-lg"
        side={isMobile ? "bottom" : "right"}
        align={isMobile ? "end" : "start"}
      >
        <DropdownMenuCheckboxItem
          checked={landing}
          disabled={landing}
          onCheckedChange={() => {
            nav.setLanding(id)
          }}
        >
          <HouseIcon className="text-muted-foreground" />
          {messages.navStartPage}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MoreTrigger({
  item,
}: {
  item: Extract<RegionItem, { kind: "trigger" }>
}) {
  const messages = usePliantMessages(navMessages)
  const label = item.label ?? messages.navMore
  return (
    <SidebarMenuItem>
      <SidebarMenuButton {...item.getTriggerProps()} tooltip={label}>
        <MoreHorizontalIcon />
        <span>{label}</span>
        <ChevronDownIcon
          className={cn(
            "ml-auto transition-transform",
            item.open && "rotate-180"
          )}
        />
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

/**
 * The links of a shadcn `Sidebar`, which users can reorder, hide and
 * collapse into a "More" item with Pliant overlays, and pick their start
 * page from. Render it in place of `SidebarMenu`. Each item keeps its own
 * `SidebarMenuItem`, so tab order follows the order users see. The item
 * that is the current page gets `aria-current="page"`.
 *
 * Wrap it in a `<nav>` with an `aria-label`, such as
 * `<nav aria-label="Main">`, so screen readers list it as a landmark. Each
 * link is a plain `<a>`; for client-side navigation, swap in your router's
 * link, such as `next/link`'s `Link`, which `SidebarMenuButton`'s `asChild`
 * passes its props and classes to.
 *
 * Each item's options menu sets it as the user's start page. Read the
 * start page with `usePliantNav(id, items).landing` where your app's start
 * route renders, and redirect to that item's `url`.
 */
function PliantNav({
  id,
  items,
  className,
  ...props
}: Omit<React.ComponentProps<typeof SidebarMenu>, "id" | "children"> & {
  /** The nav's node id: kebab-case, unique within the surface. */
  id: string
  /**
   * Each link by its id, the id overlays address it by
   * (`app-sidebar/items/reports`). The key order is the base order.
   */
  items: Readonly<Record<string, PliantNavItem>>
}) {
  const node = usePliantNodeProps(id)
  const nav = usePliantNav(id, items)
  return (
    <SidebarMenu
      {...props}
      data-slot="pliant-nav"
      {...node}
      className={className}
    >
      {useRegionItems(nav.entries).map((item) => {
        if (item.kind === "trigger") {
          return <MoreTrigger key={item.key} item={item} />
        }
        const link = items[item.entry.id]
        if (!link) {
          return null
        }
        return (
          <SidebarMenuItem
            key={item.key}
            {...item.props}
            hidden={item.mode === "hidden"}
          >
            <SidebarMenuButton
              asChild
              isActive={link.isActive ?? false}
              tooltip={link.title}
            >
              <a
                href={link.url}
                aria-current={link.isActive ? "page" : undefined}
              >
                {link.icon}
                <span>{link.title}</span>
              </a>
            </SidebarMenuButton>
            <NavItemOptions id={item.entry.id} title={link.title} nav={nav} />
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

/**
 * shadcn's `SidebarProvider`, with the open state kept as the user's own
 * default for the nav `id`: when they open or close the sidebar, the choice
 * is saved to their personal layer and applies on their next visit. Render
 * it inside the nav's `PliantRoot`. `defaultOpen` applies until a layer sets
 * the open state, such as the value your layout reads from the
 * `sidebar_state` cookie.
 */
function PliantSidebarProvider({
  id,
  defaultOpen,
  ...props
}: Omit<
  React.ComponentProps<typeof SidebarProvider>,
  "id" | "open" | "onOpenChange"
> & {
  /** The id of the nav whose open state this is. */
  id: string
}) {
  const open = usePliantNavOpen(id, { defaultOpen })
  return <SidebarProvider {...props} {...open} />
}

export { PliantNav, PliantSidebarProvider, type PliantNavItem }
