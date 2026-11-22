import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { PliantRegion } from "@/registry/pliant/pliant-region"

import { ShowcaseCard } from "./showcase-card"

function Setting({
  id,
  label,
  description,
  checked = false,
}: {
  id: string
  label: string
  description: string
  checked?: boolean
}) {
  return (
    <Field orientation="horizontal">
      <Checkbox id={`notify-${id}`} defaultChecked={checked} />
      <FieldContent>
        <FieldLabel htmlFor={`notify-${id}`}>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
    </Field>
  )
}

export function SettingsCard() {
  return (
    <ShowcaseCard
      title="Notifications"
      description="Choose the emails you get."
      target="notification-settings"
      asks={["put order alerts first", "hide product news"]}
    >
      <PliantRegion
        id="notification-settings"
        className="flex flex-col gap-4"
        slots={{
          "order-confirmations": (
            <Setting
              id="order-confirmations"
              label="Order confirmations"
              description="When a customer places or changes an order."
              checked
            />
          ),
          "order-alerts": (
            <Setting
              id="order-alerts"
              label="Order alerts"
              description="When an order becomes overdue."
              checked
            />
          ),
          "weekly-report": (
            <Setting
              id="weekly-report"
              label="Weekly report"
              description="Revenue and orders every Monday."
            />
          ),
          "product-news": (
            <Setting
              id="product-news"
              label="Product news"
              description="New features and tips."
            />
          ),
        }}
      />
    </ShowcaseCard>
  )
}
