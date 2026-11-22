"use client"

import * as React from "react"
import { LockIcon, UserIcon, UsersIcon } from "lucide-react"

import { PliantRoot, type PliantInventory } from "@pliantui/react"

import { AskChips } from "@/components/demo/ask-chips"
import { CustomizedReset } from "@/components/demo/customized-reset"
import { NotImplementedBanner } from "@/components/not-implemented-banner"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { PliantSidebarProvider } from "@/registry/pliant/pliant-nav"

import { AppSidebar } from "./app-sidebar"
import {
  isPersona,
  personas,
  storageFor,
  teamDefaultChanges,
  type Persona,
} from "./personas"

// Who's looking, and the layers they see. It sits outside the example's
// `PliantRoot`, which remounts for each persona, so the switcher keeps focus.
function PersonaBar({
  persona,
  onPersonaChange,
}: {
  persona: Persona
  onPersonaChange: (persona: Persona) => void
}) {
  return (
    <div className="flex flex-col gap-3 border-b p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="persona">View as</Label>
        <Select
          value={persona}
          onValueChange={(value) => {
            if (isPersona(value)) onPersonaChange(value)
          }}
        >
          <SelectTrigger id="persona" size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(personas).map(([value, { label }]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground">{personas[persona].description}</p>
      </div>
      <section aria-label="Layers">
        <ul className="flex flex-col gap-2">
          <li className="flex flex-wrap items-center gap-2">
            <UsersIcon aria-hidden="true" className="size-4" />
            <span className="font-medium">Team default</span>
            <span className="text-muted-foreground">
              {teamDefaultChanges.join(" ")}
            </span>
          </li>
          {persona === "you" && (
            <li className="flex flex-wrap items-center gap-2">
              <UserIcon aria-hidden="true" className="size-4" />
              <span className="font-medium">Your changes</span>
              <span className="text-muted-foreground">
                Ask for a change below, or pick a start page from a link&apos;s
                options.
              </span>
            </li>
          )}
          <li className="flex flex-wrap items-center gap-2">
            <LockIcon aria-hidden="true" className="size-4" />
            <span className="font-medium">Admin lock</span>
            <span className="text-muted-foreground">
              Settings stays in the sidebar for everyone.
            </span>
            {persona === "admin" && (
              <Badge variant="outline">Locked by you</Badge>
            )}
          </li>
        </ul>
      </section>
      <NotImplementedBanner variant="preview">
        The Customized badge previews an indicator that isn&apos;t in Pliant
        yet, and asks marked Scripted play hand-written answers. The team
        default loads from this page rather than a server, and the admin lock is
        a preview that isn&apos;t enforced.
      </NotImplementedBanner>
    </div>
  )
}

// The team workspace example: the support team's app, as you, your team
// or an admin sees it.
export function TeamWorkspaceShell({
  inventory,
  children,
}: {
  inventory: PliantInventory
  children: React.ReactNode
}) {
  const [persona, setPersona] = React.useState<Persona>("you")

  return (
    <div className="flex flex-1 flex-col">
      <PersonaBar persona={persona} onPersonaChange={setPersona} />
      <PliantRoot
        // Each persona loads its own layers.
        key={persona}
        surface="app-shell"
        storage={storageFor(persona)}
        inventory={inventory}
      >
        {/* Layout containment keeps the fixed sidebar inside the example, between the site header and footer. */}
        <PliantSidebarProvider
          id="app-sidebar"
          className="min-h-[calc(100svh-var(--header-height))] flex-1 contain-layout"
        >
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <span className="text-sm text-muted-foreground">
                Support desk
              </span>
              <div className="ml-auto">
                <CustomizedReset
                  targets={["app-sidebar"]}
                  label="the sidebar"
                />
              </div>
            </header>
            {persona === "you" && (
              <div className="border-b p-4">
                <AskChips
                  target="app-sidebar"
                  label="the sidebar"
                  prompts={["hide customers", "put settings first"]}
                />
              </div>
            )}
            {children}
          </SidebarInset>
        </PliantSidebarProvider>
      </PliantRoot>
    </div>
  )
}
