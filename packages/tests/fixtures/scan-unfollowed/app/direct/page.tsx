import { PliantRoot } from "@pliantui/react"

import { Banner } from "@/components/banner"
import DefaultBanner, {
  renderBanner,
  renderRow,
  Tree,
} from "@/components/helpers"

export default function DirectPage() {
  return (
    <PliantRoot surface="direct">
      <Banner />
      {renderBanner()}
      {["x"].map(renderRow)}
      <DefaultBanner />
      <Tree depth={1} />
    </PliantRoot>
  )
}
