import * as React from "react"
import { cva } from "class-variance-authority"

const indVariants = cva("inline-flex", {
  variants: {
    size: { sm: "h-8", lg: "h-10" },
  },
  defaultVariants: { size: null },
})

const toneVariants = cva("rounded", {
  variants: {
    tone: { plain: "bg-background", muted: "bg-muted" },
  },
  defaultVariants: { tone: void 0 },
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

function Swapped({
  tone,
  other,
}: {
  tone?: "plain" | "muted"
  other: { tone?: "plain" | "muted" }
}) {
  ;({ tone } = other)
  return <span className={toneVariants({ tone })} />
}

function Mutated({ tone }: { tone?: "plain" | "muted" }) {
  const options = { tone }
  options.tone = "muted"
  return <span className={toneVariants(options)} />
}

function Tracked({ size }: { size?: "sm" | "lg" }) {
  const seen: Record<string, boolean> = {}
  seen[String(size)] = true
  return (
    <span data-seen={Object.keys(seen)} className={indVariants({ size })} />
  )
}

export {
  Fallback,
  Indirect,
  Mutated,
  Opaque,
  Resized,
  Swapped,
  Toggle3D,
  Tracked,
}
