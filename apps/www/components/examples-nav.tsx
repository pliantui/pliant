"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

const examples = [
  { name: "Orders", href: "/examples/orders" },
  { name: "Tickets", href: "/examples/tickets" },
]

export function ExamplesNav({
  className,
  ...props
}: React.ComponentProps<"nav">) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Examples"
      className={cn("flex items-center", className)}
      {...props}
    >
      <ScrollArea className="max-w-[96%] md:max-w-[600px] lg:max-w-none">
        <div className="flex items-center">
          {examples.map((example) => {
            const isActive = pathname.startsWith(example.href)
            return (
              <Link
                key={example.href}
                href={example.href}
                aria-current={isActive ? "page" : undefined}
                data-active={isActive}
                className="flex h-7 items-center justify-center gap-2 px-4 text-center text-base font-medium text-muted-foreground transition-colors hover:text-primary data-[active=true]:text-primary"
              >
                {example.name}
              </Link>
            )
          })}
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>
    </nav>
  )
}
