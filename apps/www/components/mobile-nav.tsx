"use client"

import { useState } from "react"
import Link from "next/link"
import { MenuIcon } from "lucide-react"

import { GitHubLink } from "@/components/github-link"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { site } from "@/lib/site"

export function MobileNav({ stars }: { stars: number | null }) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <MenuIcon />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle>{site.name}</SheetTitle>
          <SheetDescription className="sr-only">
            Navigate the Pliant site.
          </SheetDescription>
        </SheetHeader>
        <nav aria-label="Mobile" className="flex flex-col p-2">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                setOpen(false)
              }}
              className="rounded-md px-3 py-2.5 text-base font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {item.title}
            </Link>
          ))}
          <GitHubLink
            stars={stars}
            className="flex items-center gap-2 rounded-md px-3 py-2.5 text-base font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </nav>
      </SheetContent>
    </Sheet>
  )
}
