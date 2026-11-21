import { Badge } from "@/components/ui/badge"

export function ComingSoon({ children }: { children: React.ReactNode }) {
  return (
    <div
      // Found by the launch check, which keeps unfinished work off the
      // launched site.
      data-unfinished="coming-soon"
      className="flex flex-col items-center gap-3 text-center"
    >
      <Badge variant="secondary" className="rounded-full px-3">
        Coming soon
      </Badge>
      <p className="max-w-xl text-base text-balance text-muted-foreground sm:text-lg">
        {children}
      </p>
    </div>
  )
}
