import type { Metadata } from "next"

import { NotImplementedBanner } from "@/components/not-implemented-banner"
import { PageHeader, PageHeaderHeading } from "@/components/page-header"

export const metadata: Metadata = {
  robots: { index: false },
  title: "Blocks",
}

export default function BlocksPage() {
  return (
    <PageHeader>
      <PageHeaderHeading>Blocks</PageHeaderHeading>
      <NotImplementedBanner className="mt-4 max-w-2xl text-left" />
    </PageHeader>
  )
}
