"use client"

import { DemoFrame } from "@/components/demo/demo-frame"
import { ticketFormAsks } from "@/lib/demo/asks"
import { TicketForm } from "@/registry/blocks/ticket-form/ticket-form"

export function TicketFormDemo() {
  return (
    <DemoFrame
      target="ticket-form"
      label="the ticket form"
      asks={ticketFormAsks}
      className="mx-auto max-w-xl"
    >
      <TicketForm />
    </DemoFrame>
  )
}
