import type { Metadata } from "next"
import Link from "next/link"

import { SearchButton } from "@/components/search-button"
import { buttonVariants } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Page not found",
}

export default function NotFound() {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-4 py-20 text-center"
    >
      <p className="text-sm font-medium text-fd-muted-foreground">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-fd-muted-foreground">
        This page doesn&apos;t exist or has moved. Search the docs, or head
        back.
      </p>
      <SearchButton />
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/docs" className={buttonVariants()}>
          Docs
        </Link>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Home
        </Link>
      </div>
    </main>
  )
}
