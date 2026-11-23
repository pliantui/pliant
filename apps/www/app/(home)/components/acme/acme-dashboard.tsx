"use client"

import * as React from "react"

import { usePliantStatus } from "@pliantui/react"
import { usePliantNav } from "@pliantui/react/nav"

import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { sections as initialSections } from "@/lib/acme/data"
import { PliantSidebarProvider } from "@/registry/pliant/pliant-nav"

import { AcmePage } from "./acme-pages"
import { AcmeSidebar } from "./acme-sidebar"
import { isMainView, mainViews, viewTitle, type View } from "./views"

const navIds = Object.fromEntries(Object.keys(mainViews).map((id) => [id, {}]))

// Opens the start page the user picked, once the layers have loaded.
function useStartPage(onView: (view: View) => void) {
  const { status } = usePliantStatus()
  const { landing } = usePliantNav("acme-nav", navIds)
  const opened = React.useRef(false)
  React.useEffect(() => {
    if (opened.current || status !== "ready") return
    opened.current = true
    if (landing !== undefined && isMainView(landing)) onView(landing)
  }, [status, landing, onView])
}

// shadcn's dashboard-01 block for a fictional company, Acme Inc., with
// Pliant in it. Render it inside the showcase's `PliantRoot`.
export function AcmeDashboard({ toolbar }: { toolbar: React.ReactNode }) {
  const [view, setView] = React.useState<View>("dashboard")
  const [sections, setSections] = React.useState(initialSections)
  useStartPage(setView)

  return (
    // Layout containment keeps the sidebar, which is fixed to the viewport
    // in an app, inside the showcase.
    <PliantSidebarProvider
      id="acme-nav"
      // Cmd/Ctrl+B belongs to the page, not the demo inside it.
      keyboardShortcut={false}
      className="min-h-[720px] contain-layout"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AcmeSidebar view={view} onView={setView} />
      <SidebarInset className="min-w-0">
        <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b">
          <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mx-2 data-[orientation=vertical]:h-4"
            />
            <h3 className="text-base font-medium">{viewTitle(view)}</h3>
            <div className="ml-auto flex items-center gap-2">{toolbar}</div>
          </div>
        </header>
        <div className="@container/main flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
          <AcmePage
            view={view}
            sections={sections}
            onSectionsChange={setSections}
            onView={setView}
          />
        </div>
      </SidebarInset>
    </PliantSidebarProvider>
  )
}
