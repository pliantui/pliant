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

// No declared props type: the rest holds whatever wasn't destructured.
function LooseBox({ tone, ...props }: any) {
  return <div data-tone={tone} className={boxVariants(props)} />
}

function NestedBox({ padding, ...outer }: any) {
  const { tone, ...inner } = outer
  return (
    <div
      data-padding={padding}
      data-tone={tone}
      className={boxVariants(inner)}
    />
  )
}

export { LooseBox, NestedBox, RestBox, SpreadBox }
