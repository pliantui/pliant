import type { Metadata } from "next"
import Link from "next/link"

import {
  PageActions,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Page not found",
}

export default function NotFound() {
  return (
    <PageHeader className="flex flex-1 flex-col justify-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <PageHeaderHeading>Page not found</PageHeaderHeading>
      <PageHeaderDescription>
        This page doesn&apos;t exist or has moved. Press{" "}
        <kbd className="rounded border bg-muted px-1 font-sans text-sm">/</kbd>{" "}
        to search the docs, or head back.
      </PageHeaderDescription>
      <PageActions>
        <Button asChild className="h-[35px] rounded-4xl px-3">
          <Link href="/docs">Docs</Link>
        </Button>
        <Button asChild variant="secondary" className="rounded-4xl px-3">
          <Link href="/">Home</Link>
        </Button>
      </PageActions>
    </PageHeader>
  )
}
