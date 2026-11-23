import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { site } from "@/lib/site"

export function Announcement() {
  return (
    <Badge asChild variant="secondary" className="bg-muted">
      <Link href={site.links.launchPost}>
        Introducing Pliant <ArrowRightIcon />
      </Link>
    </Badge>
  )
}
