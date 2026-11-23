import Link from "next/link"

import { CommandMenu } from "@/components/command-menu"
import { GitHubLink } from "@/components/github-link"
import { Logo } from "@/components/logo"
import { MainNav } from "@/components/main-nav"
import { MobileNav } from "@/components/mobile-nav"
import { ModeSwitcher } from "@/components/mode-switcher"
import { SkipLink } from "@/components/skip-link"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { site } from "@/lib/site"
import { source } from "@/lib/source"

export function SiteHeader() {
  const pageTree = source.getPageTree()

  return (
    <header className="sticky top-0 z-50 w-full bg-background group-has-[[data-slot=unfinished-strip]]/layout:mt-(--unfinished-strip-height)">
      <SkipLink />
      <div className="container-wrapper px-6">
        <div className="flex h-(--header-height) items-center **:data-[slot=separator]:h-4!">
          <MobileNav
            tree={pageTree}
            items={site.navItems}
            className="flex xl:hidden"
          />
          <Link
            href="/"
            className="mr-3 ml-3 flex items-center gap-2 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 xl:ml-0"
          >
            <Logo className="size-5" />
            {/* On a phone, beside the menu button, only the logo fits. */}
            <span className="text-lg leading-none font-semibold tracking-tight max-sm:sr-only">
              pliant
            </span>
          </Link>
          <MainNav items={site.navItems} className="hidden xl:flex" />
          <div className="ml-auto flex items-center gap-2 md:flex-1 md:justify-end">
            <div className="hidden w-full flex-1 md:flex md:w-auto md:flex-none">
              <CommandMenu tree={pageTree} navItems={site.navItems} />
            </div>
            <Separator
              orientation="vertical"
              className="ml-2 hidden lg:block"
            />
            <GitHubLink />
            <Separator orientation="vertical" />
            <ModeSwitcher />
            <Separator orientation="vertical" />
            <Button
              asChild
              size="sm"
              className="h-[31px] gap-1 rounded-lg px-2.5 text-[0.8rem] hover:bg-primary/80"
            >
              <Link href={site.links.getStarted}>Get started</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
