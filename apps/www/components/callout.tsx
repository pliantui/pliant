import { cn } from "cn"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function Callout({
  title,
  children,
  icon,
  className,
  variant = "default",
  ...props
}: Omit<React.ComponentProps<typeof Alert>, "variant"> & {
  icon?: React.ReactNode
  variant?: "default" | "info" | "warning"
}) {
  return (
    <Alert
      // A callout is part of the page, not a live announcement.
      role="note"
      data-variant={variant}
      className={cn(
        "not-typeset mt-6 w-auto rounded-2xl border-surface bg-surface text-surface-foreground md:-mx-1 **:[a]:font-medium **:[a]:underline **:[a]:decoration-current/30 **:[a]:hover:decoration-current **:[code]:border",
        className
      )}
      {...props}
    >
      {icon}
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription className="text-card-foreground/80">
        {children}
      </AlertDescription>
    </Alert>
  )
}
