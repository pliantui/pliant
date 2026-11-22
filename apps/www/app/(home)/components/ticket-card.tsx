import { TicketForm } from "../../(examples)/examples/tickets/components/ticket-form"
import { ShowcaseCard } from "./showcase-card"

export function TicketCard() {
  return (
    <ShowcaseCard
      title="New ticket"
      description="Tell support what went wrong."
      target="ticket-form"
      asks={["put priority first", "hide the CC field"]}
    >
      <TicketForm />
    </ShowcaseCard>
  )
}
