import type { Metadata } from "next"

import { PageHeader, PageHeaderHeading } from "@/components/page-header"

export const metadata: Metadata = {
  robots: { index: false },
  title: "Changelog",
}

export default function ChangelogPage() {
  return (
    <PageHeader>
      <PageHeaderHeading>Changelog</PageHeaderHeading>
    </PageHeader>
  )
}
