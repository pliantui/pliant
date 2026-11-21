"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { usePliantStatus } from "@pliantui/react"
import { usePliantNav } from "@pliantui/react/nav"

import { isSection, sections } from "../sections"

// The start route sends users to the start page they picked in the sidebar,
// or to the inbox. The landing is read once the layers are ready, so a
// saved choice is never skipped for the default. When the layers fail to
// load, there is no landing, and users go to the inbox.
export function StartPage() {
  const router = useRouter()
  const { status } = usePliantStatus()
  const { landing } = usePliantNav("app-sidebar", sections)
  useEffect(() => {
    if (status === "ready" || status === "error") {
      const section =
        landing !== undefined && isSection(landing) ? landing : "inbox"
      router.replace(sections[section].url)
    }
  }, [status, landing, router])
  return null
}
