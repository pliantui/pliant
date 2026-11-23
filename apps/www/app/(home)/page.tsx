import type { Metadata } from "next"
import Link from "next/link"
import { PlayCircleIcon } from "lucide-react"

import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"

import { Logo } from "@/components/logo"
import {
  PageActions,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { UnfinishedStrip } from "@/components/unfinished-strip"
import { inventory } from "@/lib/pliant/inventory.generated"
import { site } from "@/lib/site"

import { Announcement } from "./components/announcement"
import { Showcase } from "./components/showcase"

export const dynamic = "force-static"
export const revalidate = false

export const metadata: Metadata = {
  title: { absolute: site.headline },
  description: site.summary,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: site.url,
    title: site.headline,
    description: site.summary,
    siteName: site.name,
  },
}

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <UnfinishedStrip />
      <PageHeader className="md:**:[.container]:pb-8 lg:**:[.container]:pb-12">
        <Logo className="mb-2 size-12 md:size-14" />
        <Announcement />
        <PageHeaderHeading className="max-w-4xl">
          {site.headline}
        </PageHeaderHeading>
        <PageHeaderDescription>{site.summary}</PageHeaderDescription>
        <PageActions>
          <Button asChild className="h-[35px] rounded-4xl px-3">
            <Link href={site.links.getStarted}>Get started</Link>
          </Button>
          <Button asChild variant="secondary" className="rounded-4xl px-3">
            <Link href="/docs/components">View components</Link>
          </Button>
        </PageActions>
        <Link
          href={site.links.tour}
          // The tour video isn't recorded yet, so the unfinished work check
          // keeps this link out of a build for the production site.
          data-unfinished="coming-soon"
          className="mt-1 flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <PlayCircleIcon aria-hidden="true" className="size-4" />
          Watch the 60-second tour
        </Link>
      </PageHeader>
      <PliantRoot surface="/" storage={localAdapter} inventory={inventory["/"]}>
        <Showcase />
      </PliantRoot>
    </div>
  )
}
