import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"

export function Announcement() {
  return (
    <Badge asChild variant="secondary" className="bg-muted">
      <Link href="/changelog">
        Point at any part of a page and ask <ArrowRightIcon />
      </Link>
    </Badge>
  )
}
