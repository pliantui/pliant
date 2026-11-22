import { Badge } from "@/components/ui/badge"

// Marks an ask whose answer is hand-written rather than recorded from a
// model. The hidden comma keeps the badge from running into the ask in
// the button's accessible name.
export function ScriptedBadge() {
  return (
    <Badge
      variant="secondary"
      className="-mr-1 h-4 rounded-full px-1.5 text-[10px]"
    >
      <span className="sr-only">, </span>
      Scripted
    </Badge>
  )
}
