import { usePliantRegion } from "@pliantui/react"

export function useTwoRegions() {
  const a = usePliantRegion("two-a", { a1: <p>A1</p> })
  const b = usePliantRegion("two-b", { b1: <p>B1</p> })
  return { a, b }
}
