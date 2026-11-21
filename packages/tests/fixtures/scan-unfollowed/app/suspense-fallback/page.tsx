import { Suspense } from "react"

import { PliantRoot } from "@pliantui/react"

import { Banner } from "@/components/banner"
import { Skeleton } from "@/components/skeleton"

export default function SuspenseFallbackPage() {
  return (
    <PliantRoot surface="suspense-fallback">
      <Suspense fallback={<Skeleton />}>
        <Banner />
      </Suspense>
    </PliantRoot>
  )
}
