import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"

import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { inventory } from "@/lib/pliant/inventory.generated"
import { PliantSidebarProvider } from "@/registry/pliant/pliant-nav"

import { AppSidebar } from "./components/app-sidebar"

export default function AppExampleLayout({
  children,
}: LayoutProps<"/examples/app">) {
  return (
    <PliantRoot
      surface="app-shell"
      storage={localAdapter}
      inventory={inventory["app-shell"]}
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
          </header>
          {children}
        </SidebarInset>
      </PliantSidebarProvider>
    </PliantRoot>
  )
}
