import Link from "next/link"
import { LayoutPanelLeftIcon } from "lucide-react"

import { site } from "@/lib/site"

export function SiteLogo() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2 rounded-md font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <LayoutPanelLeftIcon className="size-5" aria-hidden="true" />
      {site.name}
    </Link>
  )
}
