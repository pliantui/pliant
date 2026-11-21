import { cn } from "cn"
import {
  FullSearchTrigger,
  SearchTrigger,
} from "fumadocs-ui/layouts/shared/slots/search-trigger"
import { ThemeSwitch } from "fumadocs-ui/layouts/shared/slots/theme-switch"

import { GitHubLink } from "@/components/github-link"
import { MainNav } from "@/components/main-nav"
import { MobileNav } from "@/components/mobile-nav"
import { SiteLogo } from "@/components/site-logo"
import { SkipLink } from "@/components/skip-link"
import { buttonVariants } from "@/components/ui/button"
import { getStarCount } from "@/lib/github"

export async function SiteHeader() {
  const stars = await getStarCount()

  return (
    <header className="sticky top-0 z-30 h-(--header-height) border-b bg-background/90 backdrop-blur-sm">
      <SkipLink />
      <div className="mx-auto flex h-full max-w-[100rem] items-center gap-2 px-4 lg:px-6">
        <MobileNav stars={stars} />
        <div className="flex items-center gap-4 lg:gap-6">
          <SiteLogo />
          <MainNav className="max-md:hidden" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <FullSearchTrigger hideIfDisabled className="w-56 max-md:hidden" />
          <SearchTrigger hideIfDisabled className="md:hidden" />
          <GitHubLink
            stars={stars}
            showLabel={false}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "max-md:hidden"
            )}
          />
          <ThemeSwitch />
        </div>
      </div>
    </header>
  )
}
