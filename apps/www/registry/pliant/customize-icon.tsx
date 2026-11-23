import * as React from "react"

/**
 * The Customize icon: a square split on its diagonal, the top piece smaller
 * and nudged away. It takes the same props as a lucide-react icon, so it sits
 * beside them in menus and buttons. Use `variant="filled"` for emphasis.
 */
function CustomizeIcon({
  size = 24,
  strokeWidth = 2,
  variant = "outline",
  ...props
}: React.ComponentProps<"svg"> & {
  size?: number | string
  strokeWidth?: number | string
  variant?: "outline" | "filled"
}) {
  const filled = variant === "filled"

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 1 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-slot="customize-icon"
      data-variant={variant}
      {...props}
    >
      <path d="M3 10.2v7.6Q3 21 6.2 21h7.6q4.2 0 1.23-2.97L5.97 8.97Q3 6 3 10.2Z" />
      <path d="M11.61 5.25h4.58q2.56 0 2.56 2.56v4.58q0 3.36-2.38.98l-5.74-5.74q-2.38-2.38.98-2.38Z" />
    </svg>
  )
}

export { CustomizeIcon }
