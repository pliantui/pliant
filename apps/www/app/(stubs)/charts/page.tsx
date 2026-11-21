import type { Metadata } from "next"

import { PageHeader, PageHeaderHeading } from "@/components/page-header"

export const metadata: Metadata = {
  robots: { index: false },
  title: "Charts",
}

export default function ChartsPage() {
  return (
    <PageHeader>
      <PageHeaderHeading>Charts</PageHeaderHeading>
    </PageHeader>
  )
}
