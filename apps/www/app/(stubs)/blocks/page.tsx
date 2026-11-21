import type { Metadata } from "next"

import { PageHeader, PageHeaderHeading } from "@/components/page-header"

export const metadata: Metadata = {
  robots: { index: false },
  title: "Blocks",
}

export default function BlocksPage() {
  return (
    <PageHeader>
      <PageHeaderHeading>Blocks</PageHeaderHeading>
    </PageHeader>
  )
}
