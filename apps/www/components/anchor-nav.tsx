import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

// Links to the sections of a page, like the blocks on the blocks page.
export function AnchorNav({
  label,
  items,
}: {
  // The nav's accessible name.
  label: string
  // Each section's element id and link text.
  items: readonly { name: string; label: string }[]
}) {
  return (
    <nav aria-label={label} className="relative overflow-hidden">
      <ScrollArea className="max-w-none">
        <div className="flex items-center">
          {items.map((item) => (
            <a
              key={item.name}
              href={`#${item.name}`}
              className="flex h-7 items-center justify-center px-4 text-center text-base font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-primary"
            >
              {item.label}
            </a>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>
    </nav>
  )
}
