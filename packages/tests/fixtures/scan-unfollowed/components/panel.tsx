import { PliantRegion } from "@/components/pliant/pliant-region"

export const panel = <PliantRegion id="panel" slots={{ body: <p>Body</p> }} />

export function Wrap() {
  return <div>{panel}</div>
}
