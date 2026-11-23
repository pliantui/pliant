"use client"

import { DemoFrame } from "@/components/demo/demo-frame"
import { useScriptedAsks } from "@/components/demo/use-scripted-asks"
import { notificationSettingsAsks } from "@/lib/demo/asks"
import type { TeamMember } from "@/lib/demo/schema"
import { SettingsPage } from "@/registry/blocks/settings-page/settings-page"

const teamDefaultsAsk = "use my team's defaults"

export function SettingsPageDemo({ user }: { user: TeamMember }) {
  const scripted = useScriptedAsks()

  return (
    <DemoFrame
      target="notification-settings"
      label="the settings"
      asks={notificationSettingsAsks}
      mocked={{
        label: "the defaults",
        asks: [teamDefaultsAsk],
        scripted,
        note: "Team defaults are shown by a scripted answer.",
      }}
      className="mx-auto max-w-2xl"
    >
      <SettingsPage user={user} teamDefaults={scripted.has(teamDefaultsAsk)} />
    </DemoFrame>
  )
}
