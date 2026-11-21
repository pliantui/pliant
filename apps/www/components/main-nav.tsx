"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { isActivePath, type NavItem } from "@/lib/nav"

export function MainNav({
  items,
  className,
  ...props
}: React.ComponentProps<"nav"> & {
  items: readonly NavItem[]
}) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main"
      className={cn("items-center gap-0", className)}
      {...props}
    >
      {items.map((item) => (
        <Button
          key={item.href}
          variant="ghost"
          asChild
          size="sm"
          className="px-2.5"
        >
          <Link
            href={item.href}
            aria-current={
              isActivePath(pathname, item.href) ? "page" : undefined
            }
            className="relative items-center"
          >
            {item.label}
          </Link>
        </Button>
      ))}
    </nav>
  )
}
