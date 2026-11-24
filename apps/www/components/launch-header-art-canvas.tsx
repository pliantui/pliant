"use client"

import * as React from "react"

import { startLaunchHeaderArt } from "@/components/launch-header-art-renderer"

export function LaunchHeaderArtCanvas({
  label,
  onReady,
  onFailure,
}: {
  label: string
  onReady: () => void
  onFailure: () => void
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    if (!canvas || !container) return
    // A fine texture only where the screen can show it.
    const imageSrc =
      window.devicePixelRatio > 1.5
        ? "/pliant-hero-2508.webp"
        : "/pliant-hero-1254.webp"
    const stop = startLaunchHeaderArt({
      canvas,
      container,
      imageSrc,
      onFirstFrame: () => {
        setReady(true)
        onReady()
      },
      onFailure,
    })
    if (!stop) {
      onFailure()
      return
    }
    return stop
  }, [onReady, onFailure])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      aria-hidden={!ready}
      className="absolute inset-0 block size-full"
    />
  )
}
