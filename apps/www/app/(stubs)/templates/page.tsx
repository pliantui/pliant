import type { Metadata } from "next"

import { PageHeader, PageHeaderHeading } from "@/components/page-header"

export const metadata: Metadata = {
  robots: { index: false },
  title: "Templates",
}

export default function TemplatesPage() {
  return (
    <PageHeader>
      <PageHeaderHeading>Templates</PageHeaderHeading>
    </PageHeader>
  )
}
