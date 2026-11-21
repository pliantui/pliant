import type { Metadata } from "next"

import { NotImplementedBanner } from "@/components/not-implemented-banner"
import { PageHeader, PageHeaderHeading } from "@/components/page-header"

export const metadata: Metadata = {
  robots: { index: false },
  title: "Components",
}

export default function ComponentsPage() {
  return (
    <PageHeader>
      <PageHeaderHeading>Components</PageHeaderHeading>
      <NotImplementedBanner className="mt-4 max-w-2xl text-left" />
    </PageHeader>
  )
}
