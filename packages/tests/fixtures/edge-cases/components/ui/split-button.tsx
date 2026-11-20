import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

const actionVariants = cva("inline-flex items-center", {
  variants: {
    size: { sm: "h-8 px-3", md: "h-10 px-4" },
  },
  defaultVariants: { size: "md" },
})

const toggleVariants = cva("inline-flex items-center border-l", {
  variants: {
    size: { sm: "h-8 w-8", md: "h-10 w-10" },
  },
  defaultVariants: { size: "sm" },
})

function SplitButton({
  size,
  children,
}: VariantProps<typeof actionVariants> & { children: React.ReactNode }) {
  return (
    <div className="inline-flex">
      <button className={actionVariants({ size })}>{children}</button>
      <button className={toggleVariants({ size })} aria-label="More" />
    </div>
  )
}

export { SplitButton }
