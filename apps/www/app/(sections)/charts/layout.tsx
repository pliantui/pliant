import type { Metadata } from "next"
import Link from "next/link"

import { AnchorNav } from "@/components/anchor-nav"
import { NotImplementedBanner } from "@/components/not-implemented-banner"
import {
  PageActions,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header"
import { PageNav } from "@/components/page-nav"
import { Button } from "@/components/ui/button"

const title = "Charts"
const description =
  "A chart starts from the data your users already look at. Each example begins with a table, a dashboard or a chart, and an ask changes it in place."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/charts" },
}

const sections = [
  { name: "from-a-table", label: "From a table" },
  { name: "from-a-dashboard", label: "From a dashboard" },
  { name: "reshape-a-chart", label: "Reshape a chart" },
  { name: "server-mode", label: "Server mode" },
]

export default function ChartsLayout({ children }: LayoutProps<"/charts">) {
  return (
    <>
      <PageHeader>
        <PageHeaderHeading>{title}</PageHeaderHeading>
        <PageHeaderDescription>{description}</PageHeaderDescription>
        <PageActions>
          <Button asChild className="h-[35px] rounded-4xl px-3">
            <a href="#charts">Browse charts</a>
          </Button>
          <Button asChild variant="secondary" className="rounded-4xl px-3">
            <Link href="/docs/components/chart">Documentation</Link>
          </Button>
        </PageActions>
        <NotImplementedBanner className="mt-4 max-w-2xl text-left">
          Charts aren&apos;t in Pliant yet, so every ask on this page plays a
          hand-written answer. The server mode example sums generated orders on
          the server in place of a database query.
        </NotImplementedBanner>
      </PageHeader>
      <PageNav id="charts">
        <AnchorNav label="Charts" items={sections} />
      </PageNav>
      <div className="container-wrapper flex-1">
        <div className="container pb-6">{children}</div>
      </div>
    </>
  )
}
