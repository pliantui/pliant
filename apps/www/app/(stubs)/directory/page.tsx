import type { Metadata } from "next"

import { PageHeader, PageHeaderHeading } from "@/components/page-header"

export const metadata: Metadata = {
  title: "Directory",
}

export default function DirectoryPage() {
  return (
    <PageHeader>
      <PageHeaderHeading>Directory</PageHeaderHeading>
    </PageHeader>
  )
}
