import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"

import { TicketForm } from "@/app/(examples)/examples/tickets/components/ticket-form"
import { DemoFrame } from "@/components/demo/demo-frame"

export function FormDemo() {
  return (
    <PliantRoot surface="/docs/components/form" storage={localAdapter}>
      <DemoFrame
        target="ticket-form"
        label="ticket form"
        asks={["put priority first", "hide the CC field"]}
      >
        <div className="mx-auto w-full max-w-md">
          <TicketForm />
        </div>
      </DemoFrame>
    </PliantRoot>
  )
}
