import * as React from "react"
import { tv, type VariantProps } from "tailwind-variants"

const card = tv({
  slots: {
    base: "flex flex-col rounded-xl border bg-card text-card-foreground",
    header: "flex flex-col gap-1.5 px-6 pt-6",
    body: "px-6 py-4",
  },
  variants: {
    shadow: {
      none: { base: "shadow-none" },
      sm: { base: "shadow-sm" },
      md: { base: "shadow-md" },
    },
    radius: {
      sm: { base: "rounded-sm" },
      lg: { base: "rounded-lg" },
    },
  },
  defaultVariants: {
    shadow: "sm",
    radius: "lg",
  },
})

const elevatedCard = tv({
  extend: card,
  variants: {
    shadow: {
      lg: { base: "shadow-lg" },
    },
  },
  defaultVariants: {
    shadow: "lg",
  },
})

/** A card that sits above the page. */
function ElevatedCard({
  shadow,
  radius,
  title,
  children,
}: VariantProps<typeof elevatedCard> & {
  title: React.ReactNode
  children: React.ReactNode
}) {
  const { base, header, body } = elevatedCard({ shadow, radius })
  return (
    <div className={base()}>
      <div className={header()}>{title}</div>
      <div className={body()}>{children}</div>
    </div>
  )
}

export { ElevatedCard }
