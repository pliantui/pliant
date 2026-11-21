import { PliantRoot } from "@pliantui/react"
import { PliantActivity } from "@pliantui/react/region"

import { Banner } from "@/components/banner"
import DefaultBanner, {
  renderBanner,
  renderRow,
  Tree,
} from "@/components/helpers"
import { MetaBanner } from "@/components/meta-banner"
import { Wrap } from "@/components/panel"

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
      <Wrap />
    </PliantRoot>
  )
}
