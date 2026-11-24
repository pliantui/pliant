"use client"

import * as React from "react"

import { startLaunchHeaderArt } from "@/components/launch-header-art-renderer"

export function LaunchHeaderArtCanvas({
  label,
  getImageSrc,
  onReady,
  onFailure,
}: {
  label: string
  getImageSrc: () => string
  onReady: () => void
  onFailure: () => void
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    if (!canvas || !container) return
    const stop = startLaunchHeaderArt({
      canvas,
      container,
      imageSrc: getImageSrc(),
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
  }, [getImageSrc, onReady, onFailure])

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
