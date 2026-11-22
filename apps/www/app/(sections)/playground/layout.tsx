import type { Metadata } from "next"
import Link from "next/link"

import {
  PageActions,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header"
import { Button } from "@/components/ui/button"

const title = "Playground"
const description =
  "Pick an example, ask for a change, and compare it with how the example started. You'll see the overlay each answer makes, and Reset puts the example back."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/playground" },
}

export default function PlaygroundLayout({
  children,
}: LayoutProps<"/playground">) {
  return (
    <>
      <PageHeader>
        <PageHeaderHeading>{title}</PageHeaderHeading>
        <PageHeaderDescription>{description}</PageHeaderDescription>
        <PageActions>
          <Button asChild className="h-[35px] rounded-4xl px-3">
            <a href="#playground">Start</a>
          </Button>
          <Button asChild variant="secondary" className="rounded-4xl px-3">
            <Link href="/docs/ai">How asking works</Link>
          </Button>
        </PageActions>
      </PageHeader>
      <div className="container-wrapper flex-1 section-soft py-6 md:py-12">
        <div id="playground" className="container scroll-mt-24">
          {children}
        </div>
      </div>
    </>
  )
}
