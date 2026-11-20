import * as React from "react"
import { tv, type VariantProps } from "tailwind-variants"

const button = tv({
  base: "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
  variants: {
    color: {
      primary: "bg-primary text-primary-foreground hover:bg-primary/90",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      danger: "bg-red-600 text-white hover:bg-red-600/90",
    },
    size: {
      sm: "h-8 px-3 text-sm",
      md: "h-10 px-4",
      lg: "h-12 px-6 text-lg",
    },
    isLoading: {
      true: "pointer-events-none opacity-50",
    },
    fullWidth: {
      true: "w-full",
    },
  },
  compoundVariants: [
    {
      color: "primary",
      size: "lg",
      class: "shadow-lg",
    },
  ],
  defaultVariants: {
    color: "primary",
    size: "md",
  },
})

type ButtonProps = React.ComponentProps<"button"> & VariantProps<typeof button>

function Button({
  className,
  color,
  size,
  isLoading,
  fullWidth,
  ...props
}: ButtonProps) {
  return (
    <button
      className={button({ color, size, isLoading, fullWidth, className })}
      {...props}
    />
  )
}

export { Button, button }
