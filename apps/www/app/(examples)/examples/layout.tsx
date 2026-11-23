import Link from "next/link"

import { ExamplesNav } from "@/components/examples-nav"
import {
  PageActions,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header"
import { PageNav } from "@/components/page-nav"
import { Button } from "@/components/ui/button"
import { UnfinishedStrip } from "@/components/unfinished-strip"
import { site } from "@/lib/site"

export const dynamic = "force-static"
export const revalidate = false

export default function ExamplesLayout({ children }: LayoutProps<"/examples">) {
  return (
    <>
      <UnfinishedStrip />
      <PageHeader>
        <PageHeaderHeading className="max-w-4xl">
          {site.headline}
        </PageHeaderHeading>
        <PageHeaderDescription>{site.summary}</PageHeaderDescription>
        <PageActions>
          <Button asChild className="h-[35px] rounded-4xl px-3">
            <Link href={site.links.getStarted}>Get started</Link>
          </Button>
          <Button asChild variant="secondary" className="rounded-4xl px-3">
            <a href={site.repository} target="_blank" rel="noreferrer">
              View on GitHub
            </a>
          </Button>
        </PageActions>
      </PageHeader>
      <PageNav id="examples">
        <ExamplesNav className="flex-1 overflow-hidden" />
      </PageNav>
      {/* With the ask panel docked beside it, the example drops the page
          gutters so its table keeps its full width. */}
      <div className="container-wrapper flex flex-1 flex-col section-soft pb-6 group-has-[[data-slot=pliant-ask-panel]]/layout:px-0">
        <div className="container flex flex-1 scroll-mt-20 flex-col group-has-[[data-slot=pliant-ask-panel]]/layout:px-0">
          <div className="flex flex-col overflow-hidden rounded-lg border bg-background bg-clip-padding group-has-[[data-slot=pliant-ask-panel]]/layout:rounded-none group-has-[[data-slot=pliant-ask-panel]]/layout:border-x-0 md:flex-1 xl:rounded-xl">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
