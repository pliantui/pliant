import * as React from "react"

export function Section({
  title,
  ...props
}: React.ComponentProps<"section"> & { title: string }) {
  return (
    <section aria-label={title}>
      <h2>{title}</h2>
      <div {...props} />
    </section>
  )
}
