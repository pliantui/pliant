"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"

import { site } from "@/lib/site"

export function MainNav({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Main" className={cn("flex items-center gap-1", className)}>
      {site.nav.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
              active ? "text-foreground" : "text-fd-muted-foreground"
            )}
          >
            {item.title}
          </Link>
        )
      })}
    </nav>
  )
}
