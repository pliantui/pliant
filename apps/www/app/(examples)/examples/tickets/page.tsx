import type { Metadata } from "next"

import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"
import { PliantPrePaint } from "@pliantui/react/pre-paint"

import { DemoAsk } from "@/components/demo/demo-ask-panel"
import { DemoCustomizeSurface } from "@/components/demo/demo-customize"
import { PageCustomizeMenu } from "@/components/demo/page-customize-menu"
import { ticketFormAsks } from "@/lib/demo/asks"
import { inventory } from "@/lib/pliant/inventory.generated"
import { TicketForm } from "@/registry/blocks/ticket-form/ticket-form"

export const metadata: Metadata = {
  title: "New ticket",
  alternates: { canonical: "/examples/tickets" },
}

export default function TicketsPage() {
  return (
    <div className="flex-1 bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8 lg:px-6">
        <PliantRoot
          surface="/examples/tickets"
          storage={localAdapter}
          inventory={inventory["/examples/tickets"]}
        >
          <DemoAsk
            targets={[
              {
                id: "ticket-form",
                label: "Ticket form",
                suggestions: ticketFormAsks,
              },
            ]}
          >
            <PliantPrePaint surface="/examples/tickets" />
            <header className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold tracking-tight">
                  New ticket
                </h2>
                <p className="text-sm text-muted-foreground">
                  Tell us what went wrong and we&apos;ll get back to you.
                </p>
              </div>
              <PageCustomizeMenu targets={["ticket-form"]} label="the form" />
            </header>
            <DemoCustomizeSurface targets={["ticket-form"]}>
              <div>
                <TicketForm />
              </div>
            </DemoCustomizeSurface>
          </DemoAsk>
        </PliantRoot>
      </div>
    </div>
  )
}
