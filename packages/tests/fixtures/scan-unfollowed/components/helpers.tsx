import * as React from "react"

import { Banner } from "@/components/banner"

export function renderBanner() {
  return <Banner />
}

export function renderRow(row: string) {
  return (
    <div key={row}>
      <Banner />
    </div>
  )
}

export function withBox<P extends object>(Inner: React.ComponentType<P>) {
  return function Boxed(props: P) {
    return (
      <div>
        <Inner {...props} />
      </div>
    )
  }
}

export function Tree({ depth }: { depth: number }) {
  return (
    <div>
      {depth > 0 ? <Tree depth={depth - 1} /> : null}
      <Banner />
    </div>
  )
}

export default function DefaultBanner() {
  return <Banner />
}

export { Banner as ReBanner } from "@/components/banner"
