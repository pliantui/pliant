import type { Metadata } from "next"
import Link from "next/link"

import {
  PageActions,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { site } from "@/lib/site"

export const dynamic = "force-static"
export const revalidate = false

export const metadata: Metadata = {
  alternates: { canonical: "/" },
}

export default function HomePage() {
  return (
    <PageHeader>
      <PageHeaderHeading className="max-w-4xl">
        {site.headline}
      </PageHeaderHeading>
      <PageHeaderDescription>{site.summary}</PageHeaderDescription>
      <PageActions>
        <Button asChild className="h-[35px] rounded-4xl px-3">
          <Link href={site.links.getStarted}>Get Started</Link>
        </Button>
        <Button asChild variant="secondary" className="rounded-4xl px-3">
          <Link href="/examples/orders">View Examples</Link>
        </Button>
      </PageActions>
    </PageHeader>
  )
}
