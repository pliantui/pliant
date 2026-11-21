"use client"

import { usePathname } from "next/navigation"

// Fumadocs marks the docs content with its own id, so the link points there on
// docs pages and at the main landmark everywhere else.
export function SkipLink() {
  const pathname = usePathname()
  const target =
    pathname === "/docs" || pathname.startsWith("/docs/") ? "nd-page" : "main"

  return (
    <a
      href={`#${target}`}
      className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:rounded-md focus-visible:border focus-visible:bg-background focus-visible:px-3 focus-visible:py-1.5 focus-visible:text-sm focus-visible:font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      Skip to content
    </a>
  )
}
