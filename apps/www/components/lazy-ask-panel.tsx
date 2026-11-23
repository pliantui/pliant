"use client"

import dynamic from "next/dynamic"

// The ask panel, loaded only in the browser, so neither it nor its chat is
// in the server bundle of the site's worker.
export const LazyAskPanel = dynamic(
  () =>
    import("@/registry/pliant/pliant-ask-panel").then(
      (module) => module.PliantAskPanel
    ),
  { ssr: false }
)
