import type { Metadata } from "next"

import { PageHeader, PageHeaderHeading } from "@/components/page-header"

export const metadata: Metadata = {
  title: "Playground",
}

export default function PlaygroundPage() {
  return (
    <PageHeader>
      <PageHeaderHeading>Playground</PageHeaderHeading>
    </PageHeader>
  )
}
