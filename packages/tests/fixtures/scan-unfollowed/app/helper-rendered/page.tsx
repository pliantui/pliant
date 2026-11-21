import { PliantRoot } from "@pliantui/react"

import { renderHidden } from "@/components/hidden-region"

export default function HelperRenderedPage() {
  return <PliantRoot surface="helper-rendered">{renderHidden()}</PliantRoot>
}
