import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { TeamMember } from "@/lib/demo/schema"
import { PliantRegion } from "@/registry/pliant/pliant-region"

interface Setting {
  label: string
  description: string
  checked: boolean
  // What the team picked for everyone, where it differs from the default.
  team?: boolean
}

const settings = {
  "order-confirmations": {
    label: "Order confirmations",
    description: "When a customer places or changes an order.",
    checked: true,
  },
  "order-alerts": {
    label: "Order alerts",
    description: "When an order becomes overdue.",
    checked: true,
  },
  "weekly-report": {
    label: "Weekly report",
    description: "Revenue and orders every Monday.",
    checked: false,
    team: true,
  },
  "refund-requests": {
    label: "Refund requests",
    description: "When a customer asks for a refund.",
    checked: false,
    team: true,
  },
  "product-news": {
    label: "Product news",
    description: "New features and tips.",
    checked: false,
  },
} satisfies Record<string, Setting>

function SettingField({
  id,
  setting,
  teamDefaults,
}: {
  id: string
  setting: Setting
  teamDefaults: boolean
}) {
  const fromTeam = teamDefaults && setting.team !== undefined
  const checked = fromTeam ? (setting.team ?? false) : setting.checked

  return (
    <Field orientation="horizontal">
      <Checkbox
        // Remounts when the defaults change, so it shows the new default.
        key={String(checked)}
        id={`setting-${id}`}
        defaultChecked={checked}
      />
      <FieldContent>
        <FieldLabel htmlFor={`setting-${id}`}>
          {setting.label}
          {fromTeam && <Badge variant="outline">Team default</Badge>}
        </FieldLabel>
        <FieldDescription>{setting.description}</FieldDescription>
      </FieldContent>
    </Field>
  )
}

// An account settings page whose notification settings the user can
// reorder and hide.
export function SettingsPage({
  user,
  teamDefaults,
}: {
  user: TeamMember
  // Whether the settings show the defaults the user's team picked.
  teamDefaults: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-4">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How your name shows to your team.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="settings-name">Name</FieldLabel>
              <Input id="settings-name" defaultValue={user.name} />
            </Field>
            <Field>
              <FieldLabel htmlFor="settings-email">Email</FieldLabel>
              <Input
                id="settings-email"
                type="email"
                defaultValue={user.email}
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
      <Card className="gap-4">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            {teamDefaults
              ? `Your ${user.team} team's defaults.`
              : "Choose the emails you get."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PliantRegion
            id="notification-settings"
            className="flex flex-col gap-4"
            slots={{
              "order-confirmations": (
                <SettingField
                  id="order-confirmations"
                  setting={settings["order-confirmations"]}
                  teamDefaults={teamDefaults}
                />
              ),
              "order-alerts": (
                <SettingField
                  id="order-alerts"
                  setting={settings["order-alerts"]}
                  teamDefaults={teamDefaults}
                />
              ),
              "weekly-report": (
                <SettingField
                  id="weekly-report"
                  setting={settings["weekly-report"]}
                  teamDefaults={teamDefaults}
                />
              ),
              "refund-requests": (
                <SettingField
                  id="refund-requests"
                  setting={settings["refund-requests"]}
                  teamDefaults={teamDefaults}
                />
              ),
              "product-news": (
                <SettingField
                  id="product-news"
                  setting={settings["product-news"]}
                  teamDefaults={teamDefaults}
                />
              ),
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
