import type { Metadata } from "next"

import { PageHeader, PageHeaderHeading } from "@/components/page-header"

export const metadata: Metadata = {
  robots: { index: false },
  title: "Roadmap",
}

export default function RoadmapPage() {
  return (
    <PageHeader>
      <PageHeaderHeading>Roadmap</PageHeaderHeading>
    </PageHeader>
  )
}
