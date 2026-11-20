import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

const bannerVariants = cva("flex w-full items-center", {
  variants: {
    tone: {
      neutral: "bg-muted",
      brand: "bg-primary text-primary-foreground",
    },
    size: {
      sm: "h-8",
      lg: "h-12",
    },
  },
})

type BannerProps = React.ComponentProps<"div"> &
  VariantProps<typeof bannerVariants>

function Banner({ className, ...props }: BannerProps) {
  return (
    <div
      className={bannerVariants({ tone: "brand", ...props, size: "lg" })}
      {...props}
    />
  )
}

export { Banner }
