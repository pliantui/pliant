"use client"

import * as React from "react"
import dynamic from "next/dynamic"

// The animation loads only in the browser and only when motion is welcome,
// so neither the worker nor other pages carry it.
const LaunchHeaderArtCanvas = dynamic(
  () =>
    import("@/components/launch-header-art-canvas").then(
      (module) => module.LaunchHeaderArtCanvas
    ),
  { ssr: false }
)

const label =
  "The Pliant tangram in iridescent lacquered metal, its pieces breathing and slowly dissolving into fine pixels and back"

const reducedMotion = "(prefers-reduced-motion: reduce)"

function subscribe(onChange: () => void) {
  const query = window.matchMedia(reducedMotion)
  query.addEventListener("change", onChange)
  return () => {
    query.removeEventListener("change", onChange)
  }
}

// False on the server and during hydration, so the animation starts only
// after the page's first paint.
function useMotionAllowed() {
  return React.useSyncExternalStore(
    subscribe,
    () => !window.matchMedia(reducedMotion).matches,
    () => false
  )
}

export function LaunchHeaderArt() {
  const motionAllowed = useMotionAllowed()
  const [state, setState] = React.useState<"loading" | "ready" | "failed">(
    "loading"
  )
  const onReady = React.useCallback(() => {
    setState("ready")
  }, [])
  const onFailure = React.useCallback(() => {
    setState("failed")
  }, [])
  const animated = motionAllowed && state !== "failed"

  return (
    <div className="relative mx-auto aspect-square w-full max-w-md">
      {!(animated && state === "ready") && (
        <picture>
          <source media={reducedMotion} srcSet="/pliant-hero-1254.webp" />
          {/* Sized like the animation, which draws the art at 98% of the square. */}
          <img
            src="/pliant-hero-1254.webp"
            srcSet="/pliant-hero-1254.webp 1x, /pliant-hero-2508.webp 2x"
            alt={label}
            width={1254}
            height={1254}
            fetchPriority="high"
            className="absolute top-[1%] left-[1%] block size-[98%]"
          />
        </picture>
      )}
      {animated && (
        <LaunchHeaderArtCanvas
          label={label}
          onReady={onReady}
          onFailure={onFailure}
        />
      )}
    </div>
  )
}
