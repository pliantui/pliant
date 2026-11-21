import type { Metadata } from "next"

import { ComingSoon } from "@/components/coming-soon"
import { PageHeader, PageHeaderHeading } from "@/components/page-header"

export const metadata: Metadata = {
  robots: { index: false },
  title: "Templates",
}

export default function TemplatesPage() {
  return (
    <PageHeader>
      <PageHeaderHeading>Templates</PageHeaderHeading>
      <ComingSoon>
        Ready-made app templates and premium components, built with Pliant.
      </ComingSoon>
    </PageHeader>
  )
}
