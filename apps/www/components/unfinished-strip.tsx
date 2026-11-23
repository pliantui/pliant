"use client"

import { usePathname } from "next/navigation"

function isUnfinishedRoute(pathname: string, routes: readonly string[]) {
  return routes.some((route) =>
    route.endsWith("/*")
      ? pathname.startsWith(route.slice(0, -1))
      : pathname === route
  )
}

// A slim amber strip across the top of every page that shows unfinished
// work. The amber dots mark which parts.
export function UnfinishedStrip({ routes }: { routes: readonly string[] }) {
  const pathname = usePathname()
  if (!isUnfinishedRoute(pathname, routes)) return null

  return (
    <div
      role="note"
      // Found by the unfinished work check, which keeps unfinished work out of
      // a build for the production site.
      data-unfinished="not-implemented"
      className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-950 sm:text-sm dark:bg-amber-950 dark:text-amber-100"
    >
      This page contains unfinished components and work.
    </div>
  )
}
