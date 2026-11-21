import type { Metadata } from "next"

import { ComingSoon } from "@/components/coming-soon"
import { PageHeader, PageHeaderHeading } from "@/components/page-header"

export const metadata: Metadata = {
  robots: { index: false },
  title: "Directory",
}

export default function DirectoryPage() {
  return (
    <PageHeader>
      <PageHeaderHeading>Directory</PageHeaderHeading>
      <ComingSoon>
        A directory of shadcn registries whose components work with Pliant.
      </ComingSoon>
    </PageHeader>
  )
}
