import * as React from "react"

import { cva } from "@/lib/legacy"

const eyebrowVariants = cva("text-xs uppercase")

function Eyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={eyebrowVariants()} {...props} />
}

export { Eyebrow }
