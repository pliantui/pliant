import type { Metadata } from "next"

import { PageHeader, PageHeaderHeading } from "@/components/page-header"

export const metadata: Metadata = {
  title: "Roadmap",
}

export default function RoadmapPage() {
  return (
    <PageHeader>
      <PageHeaderHeading>Roadmap</PageHeaderHeading>
    </PageHeader>
  )
}
