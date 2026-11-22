import type { Metadata } from "next"

import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"
import { PliantPrePaint } from "@pliantui/react/pre-paint"

import { SettingsPageDemo } from "@/components/blocks/settings-page-demo"
import { team } from "@/lib/demo/data"
import { inventory } from "@/lib/pliant/inventory.generated"

export const metadata: Metadata = {
  title: "Settings",
  alternates: { canonical: "/examples/settings" },
}

export default function SettingsExamplePage() {
  const user = team.find((member) => member.role === "Account manager")
  if (!user) throw new Error("The demo team has no account manager")

  return (
    <div className="flex-1 bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 lg:px-6">
        <PliantRoot
          surface="/examples/settings"
          storage={localAdapter}
          inventory={inventory["/examples/settings"]}
        >
          <PliantPrePaint surface="/examples/settings" />
          <header className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
            <p className="text-sm text-muted-foreground">
              Your profile and the emails you get.
            </p>
          </header>
          <SettingsPageDemo user={user} />
        </PliantRoot>
      </div>
    </div>
  )
}
