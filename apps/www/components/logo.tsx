import { cn } from "cn"

const pieces = [
  { points: "6.17,4.90 41.83,4.90 24.00,22.73", color: "#ef4444" },
  { points: "43.10,6.17 43.10,41.83 25.27,24.00", color: "#facc15" },
  { points: "4.90,26.17 21.83,43.10 4.90,43.10", color: "#3b82f6" },
  {
    points: "16.17,34.90 33.63,34.90 41.83,43.10 24.37,43.10",
    color: "#22c55e",
  },
  { points: "4.90,6.17 12.73,14.00 4.90,21.83", color: "#a855f7" },
  {
    points: "14.00,15.27 22.73,24.00 14.00,32.73 5.27,24.00",
    color: "#f97316",
  },
  { points: "24.00,25.27 31.83,33.10 16.17,33.10", color: "#ec4899" },
]

// Pliant's logo: a seven-piece tangram. It's decorative wherever it sits
// beside the name, so it's hidden from screen readers.
export function Logo({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="2 2 44 44"
      aria-hidden="true"
      className={cn("size-6 shrink-0", className)}
      {...props}
    >
      {pieces.map(({ points, color }) => (
        <polygon
          key={points}
          points={points}
          fill={color}
          stroke={color}
          strokeWidth={0.6}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}
