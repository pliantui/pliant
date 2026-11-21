import { PliantRoot } from "@pliantui/react"

import { AppSidebar } from "@/components/app-sidebar"

export default function InboxPage() {
  return (
    <PliantRoot surface="app-shell">
      <AppSidebar />
      <main>Inbox</main>
    </PliantRoot>
  )
}
