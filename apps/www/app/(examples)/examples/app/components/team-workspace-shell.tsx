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

function Layers({ persona }: { persona: Persona }) {
  return (
    <section
      aria-label="Layers"
      className="mx-4 mt-4 flex flex-col gap-3 rounded-lg border p-4 text-sm"
    >
      <p className="text-muted-foreground">{personas[persona].description}</p>
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
              Ask for a change, or pick a start page from a link&apos;s options.
            </span>
            <div className="w-full pl-6">
              <AskChips
                target="app-sidebar"
                label="the sidebar"
                prompts={["hide customers", "put settings first"]}
              />
            </div>
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
            <span className="text-sm text-muted-foreground">Support desk</span>
            <div className="ml-auto flex items-center gap-2">
              <Label htmlFor="persona" className="text-muted-foreground">
                View as
              </Label>
              <Select
                value={persona}
                onValueChange={(value) => {
                  if (isPersona(value)) setPersona(value)
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
              <CustomizedReset targets={["app-sidebar"]} label="the sidebar" />
            </div>
          </header>
          <Layers persona={persona} />
          <NotImplementedBanner variant="preview" className="mx-4 mt-4 w-auto">
            The Customized badge previews an indicator that isn&apos;t in Pliant
            yet, and asks marked Scripted play hand-written answers. The team
            default loads from this page rather than a server, and the admin
            lock is a preview that isn&apos;t enforced.
          </NotImplementedBanner>
          {children}
        </SidebarInset>
      </PliantSidebarProvider>
    </PliantRoot>
  )
}
