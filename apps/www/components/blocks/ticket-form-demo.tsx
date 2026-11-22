"use client"

import { TicketForm } from "@/app/(examples)/examples/tickets/components/ticket-form"
import { DemoFrame } from "@/components/demo/demo-frame"

export function TicketFormDemo() {
  return (
    <DemoFrame
      target="ticket-form"
      label="the ticket form"
      asks={["put priority first", "hide the CC field"]}
      className="mx-auto max-w-xl"
    >
      <TicketForm />
    </DemoFrame>
  )
}
