import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

const boxVariants = cva("rounded-md", {
  variants: {
    tone: { plain: "bg-background", muted: "bg-muted" },
    padding: { sm: "p-2", lg: "p-6" },
  },
})

type BoxProps = React.ComponentProps<"div"> & VariantProps<typeof boxVariants>

function SpreadBox({ tone, ...props }: BoxProps) {
  return <div data-tone={tone} className={boxVariants({ ...props })} />
}

function RestBox({ tone, ...props }: BoxProps) {
  return <div data-tone={tone} className={boxVariants(props)} />
}

export { RestBox, SpreadBox }
