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
import { blocks } from "@/lib/blocks/blocks"

const title = "Blocks"
const description =
  "Page sections built with Pliant's components. Try a block's suggested asks to see it change, then copy its files into your app."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/blocks" },
}

export default function BlocksLayout({ children }: LayoutProps<"/blocks">) {
  return (
    <>
      <UnfinishedStrip />
      <PageHeader>
        <PageHeaderHeading>{title}</PageHeaderHeading>
        <PageHeaderDescription>{description}</PageHeaderDescription>
        <PageActions>
          <Button asChild className="h-[35px] rounded-4xl px-3">
            <a href="#blocks">Browse blocks</a>
          </Button>
          <Button asChild variant="secondary" className="rounded-4xl px-3">
            <Link href="/docs/components">View components</Link>
          </Button>
        </PageActions>
      </PageHeader>
      <PageNav id="blocks">
        <AnchorNav
          label="Blocks"
          // No block is in the registry yet.
          items={blocks.map((block) => ({ ...block, unfinished: true }))}
        />
      </PageNav>
      <div className="container-wrapper flex-1 section-soft md:py-12">
        <div className="container">{children}</div>
      </div>
    </>
  )
}
