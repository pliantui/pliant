import { PliantActivity, PliantRoot } from "@pliantui/react"

import { Banner } from "@/components/banner"
import DefaultBanner, {
  renderBanner,
  renderRow,
  Tree,
} from "@/components/helpers"
import { MetaBanner } from "@/components/meta-banner"

export default function DirectPage() {
  return (
    <PliantRoot surface="direct">
      <PliantActivity mode="visible">
        <Banner />
      </PliantActivity>
      {renderBanner()}
      {renderRow("x")}
      <DefaultBanner />
      <Tree depth={1} />
      <MetaBanner table />
    </PliantRoot>
  )
}
