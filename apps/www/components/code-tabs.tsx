"use client"

import * as React from "react"

import { Tabs } from "@/components/ui/tabs"
import { useConfig } from "@/hooks/use-config"

export function CodeTabs({ children }: React.ComponentProps<typeof Tabs>) {
  const [config, setConfig] = useConfig()

  return (
    <Tabs
      value={config.installationType}
      onValueChange={(value) => {
        if (value === "cli" || value === "manual") {
          setConfig({ ...config, installationType: value })
        }
      }}
      className="relative mt-6 w-full *:data-[slot=tabs-list]:gap-6"
    >
      {children}
    </Tabs>
  )
}
