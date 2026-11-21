import type { Metadata } from "next"

import { PageHeader, PageHeaderHeading } from "@/components/page-header"

export const metadata: Metadata = {
  robots: { index: false },
  title: "Components",
}

export default function ComponentsPage() {
  return (
    <PageHeader>
      <PageHeaderHeading>Components</PageHeaderHeading>
    </PageHeader>
  )
}
