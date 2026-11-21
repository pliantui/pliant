import { PliantRoot } from "@pliantui/react"

import { PliantForm } from "@/components/pliant/pliant-form"
import { PliantRegion } from "@/components/pliant/pliant-region"

export default function TicketsPage() {
  return (
    <PliantRoot surface="tickets">
      <PliantRegion
        id="ticket-page"
        slots={{
          "ticket-form": (
            <PliantForm
              id="ticket-form"
              fields={{
                subject: <input name="subject" />,
                orderId: (
                  <PliantRegion
                    id="order-hints"
                    slots={{ hint: <p>Hint</p> }}
                  />
                ),
                cc: <input name="cc" />,
              }}
            />
          ),
        }}
      />
    </PliantRoot>
  )
}
