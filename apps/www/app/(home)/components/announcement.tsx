import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"

export function Announcement() {
  return (
    <Badge asChild variant="secondary" className="bg-muted">
      <Link href="/docs/ai">
        New: point at part of a page and ask for a change <ArrowRightIcon />
      </Link>
    </Badge>
  )
}
