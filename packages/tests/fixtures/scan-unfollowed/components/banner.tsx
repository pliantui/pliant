import { PliantRegion } from "@/components/pliant/pliant-region"

export function Banner() {
  return <PliantRegion id="banner" slots={{ message: <p>Message</p> }} />
}
