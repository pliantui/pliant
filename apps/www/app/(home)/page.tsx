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

export default function HomePage() {
  return (
    <PageHeader>
      <PageHeaderHeading className="max-w-4xl">
        Build pliant interfaces: apps your users can reshape.
      </PageHeaderHeading>
      <PageHeaderDescription>
        Pliant adds per-user and per-team customization to your shadcn app,
        within the rules you set.
      </PageHeaderDescription>
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
