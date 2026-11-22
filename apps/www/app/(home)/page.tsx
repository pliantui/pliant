import type { Metadata } from "next"
import Link from "next/link"

import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"

import {
  PageActions,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { inventory } from "@/lib/pliant/inventory.generated"
import { site } from "@/lib/site"

import { Announcement } from "./components/announcement"
import { Beats } from "./components/beats"
import { Install } from "./components/install"
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
      <PageHeader className="md:**:[.container]:pb-8 lg:**:[.container]:pb-12">
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
            <Link href="/components">View components</Link>
          </Button>
        </PageActions>
      </PageHeader>
      <PliantRoot surface="/" storage={localAdapter} inventory={inventory["/"]}>
        <Showcase />
      </PliantRoot>
      <Beats />
      <Install />
    </div>
  )
}
