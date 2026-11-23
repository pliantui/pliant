import type { Metadata } from "next"
import Link from "next/link"

import { AnchorNav } from "@/components/anchor-nav"
import {
  PageActions,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header"
import { PageNav } from "@/components/page-nav"
import { Button } from "@/components/ui/button"
import { UnfinishedStrip } from "@/components/unfinished-strip"

const title = "Charts"
const description =
  "A chart starts from the data your users already look at. Each example begins with a table or a dashboard, and an ask charts it in place."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/charts" },
}

const sections = [
  { name: "from-a-table", label: "From a table", unfinished: true },
  { name: "from-a-dashboard", label: "From a dashboard", unfinished: true },
  { name: "server-mode", label: "Server mode", unfinished: true },
]

export default function ChartsLayout({ children }: LayoutProps<"/charts">) {
  return (
    <>
      <UnfinishedStrip />
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
        <p className="max-w-2xl text-sm text-balance text-muted-foreground">
          The server mode example sums 250,000 generated orders when the page
          builds, in place of a database query, and its asks switch between the
          precomputed monthly and weekly totals.
        </p>
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
