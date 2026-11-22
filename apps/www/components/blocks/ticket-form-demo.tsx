"use client"

import { DemoFrame } from "@/components/demo/demo-frame"
import { TicketForm } from "@/registry/blocks/ticket-form/ticket-form"

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
