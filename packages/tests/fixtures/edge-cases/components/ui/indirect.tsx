import * as React from "react"
import { cva } from "class-variance-authority"

const indVariants = cva("inline-flex", {
  variants: {
    size: { sm: "h-8", lg: "h-10" },
  },
  defaultVariants: { size: null },
})

function makeOptions(size?: "sm" | "lg") {
  return { size }
}

function Indirect({ size }: { size?: "sm" | "lg" }) {
  const options = { size }
  return <span className={indVariants(options)} />
}

function Opaque({ size }: { size?: "sm" | "lg" }) {
  return <span className={indVariants(makeOptions(size))} />
}

function Fallback({ size }: { size?: "sm" | "lg" }) {
  return <span className={indVariants({ size: size ?? "lg" })} />
}

function Resized({ size }: { size?: "sm" | "lg" }) {
  if (!size) {
    size = "sm"
  }
  return <span className={indVariants({ size })} />
}

function Toggle3D({
  size,
  pressed,
}: {
  size?: "sm" | "lg"
  pressed?: boolean
}) {
  return (
    <span
      className={indVariants({ size: pressed ? "lg" : size })}
      aria-pressed={pressed}
    />
  )
}

export { Fallback, Indirect, Opaque, Resized, Toggle3D }
