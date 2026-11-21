import type * as React from "react"

import { panel } from "@/components/panel"

export const panels = new Map<string, React.ReactNode>()
panels.set("panel", panel)
