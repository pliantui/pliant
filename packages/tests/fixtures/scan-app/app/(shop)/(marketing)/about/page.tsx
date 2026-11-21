import { PliantRegion } from "@/components/pliant/pliant-region"

function AboutPage() {
  return <PliantRegion id="about" slots={{ story: <p>Our story</p> }} />
}

export { AboutPage as default }
