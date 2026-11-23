"use client"

import * as React from "react"
import {
  BarChart3Icon,
  BookOpenIcon,
  CircleHelpIcon,
  CirclePlusIcon,
  DatabaseIcon,
  FileTextIcon,
  FolderIcon,
  LayoutDashboardIcon,
  ListIcon,
  MailIcon,
  MoreHorizontalIcon,
  PaletteIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  SquareIcon,
  UsersIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { PliantNav, type PliantNavItem } from "@/registry/pliant/pliant-nav"

import { SurfaceAsks } from "./surface-asks"
import { isMainView, mainViews, type MainView, type View } from "./views"

const mainIcons = {
  dashboard: <LayoutDashboardIcon />,
  lifecycle: <ListIcon />,
  analytics: <BarChart3Icon />,
  projects: <FolderIcon />,
  team: <UsersIcon />,
} satisfies Record<MainView, React.ReactNode>

const documents: { id: View; title: string; icon: React.ReactNode }[] = [
  { id: "data-library", title: "Data Library", icon: <DatabaseIcon /> },
  { id: "reports", title: "Reports", icon: <FileTextIcon /> },
  { id: "word-assistant", title: "Word Assistant", icon: <SparklesIcon /> },
]

const moreDocuments: typeof documents = [
  {
    id: "proposal-templates",
    title: "Proposal Templates",
    icon: <BookOpenIcon />,
  },
  { id: "brand-guide", title: "Brand Guide", icon: <PaletteIcon /> },
]

const secondary: typeof documents = [
  { id: "settings", title: "Settings", icon: <SettingsIcon /> },
  { id: "help", title: "Get Help", icon: <CircleHelpIcon /> },
  { id: "search", title: "Search", icon: <SearchIcon /> },
]

function ViewLink({
  item,
  view,
  onView,
}: {
  item: (typeof documents)[number]
  view: View
  onView: (view: View) => void
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={view === item.id}
        aria-current={view === item.id ? "page" : undefined}
        onClick={() => {
          onView(item.id)
        }}
      >
        {item.icon}
        <span>{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

// The sidebar of shadcn's dashboard-01 block, with its main links in a
// `PliantNav` that each user can trim and give a start page.
export function AcmeSidebar({
  view,
  onView,
}: {
  view: View
  onView: (view: View) => void
}) {
  const [showMore, setShowMore] = React.useState(false)
  const link = (id: MainView): PliantNavItem => ({
    title: mainViews[id],
    url: `#${id}`,
    icon: mainIcons[id],
    isActive: view === id,
  })

  return (
    <Sidebar collapsible="offcanvas" variant="inset" className="h-auto!">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              onClick={() => {
                onView("dashboard")
              }}
            >
              <SquareIcon className="size-5! rotate-45" />
              <span className="text-base font-semibold">Acme Inc.</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              <SidebarMenuItem className="flex items-center gap-2">
                <SidebarMenuButton
                  tooltip="Quick Create"
                  className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
                  onClick={() => {
                    onView("quick-create")
                  }}
                >
                  <CirclePlusIcon />
                  <span>Quick Create</span>
                </SidebarMenuButton>
                <Button
                  size="icon"
                  className="size-8 group-data-[collapsible=icon]:opacity-0"
                  variant="outline"
                  onClick={() => {
                    onView("inbox")
                  }}
                >
                  <MailIcon />
                  <span className="sr-only">Inbox</span>
                </Button>
              </SidebarMenuItem>
            </SidebarMenu>
            <nav
              aria-label="Acme"
              // The links switch the dashboard's page in place.
              onClickCapture={(event) => {
                if (!(event.target instanceof Element)) return
                const link = event.target.closest("a")
                const id = link?.getAttribute("href")?.slice(1)
                if (id && isMainView(id)) {
                  event.preventDefault()
                  onView(id)
                }
              }}
            >
              <PliantNav
                id="acme-nav"
                items={{
                  dashboard: link("dashboard"),
                  lifecycle: link("lifecycle"),
                  analytics: link("analytics"),
                  projects: link("projects"),
                  team: link("team"),
                }}
              />
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <div className="px-2">
            <SurfaceAsks
              target="acme-nav"
              label="the sidebar"
              prompts={[
                "open Analytics when I log in",
                "move what I don't use under More",
              ]}
            />
          </div>
        </SidebarGroup>
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Documents</SidebarGroupLabel>
          <SidebarMenu>
            {[...documents, ...(showMore ? moreDocuments : [])].map((item) => (
              <ViewLink key={item.id} item={item} view={view} onView={onView} />
            ))}
            <SidebarMenuItem>
              <SidebarMenuButton
                className="text-sidebar-foreground/70"
                aria-expanded={showMore}
                onClick={() => {
                  setShowMore(!showMore)
                }}
              >
                <MoreHorizontalIcon className="text-sidebar-foreground/70" />
                <span>{showMore ? "Less" : "More"}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {secondary.map((item) => (
                <ViewLink
                  key={item.id}
                  item={item}
                  view={view}
                  onView={onView}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              onClick={() => {
                onView("settings")
              }}
            >
              <span
                aria-hidden="true"
                className="flex size-8 items-center justify-center rounded-lg bg-muted text-xs font-medium grayscale"
              >
                EL
              </span>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Eddie Lake</span>
                <span className="truncate text-xs text-muted-foreground">
                  eddie@acme.example
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
