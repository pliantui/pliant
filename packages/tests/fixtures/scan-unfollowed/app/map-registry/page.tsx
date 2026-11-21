import { PliantRoot } from "@pliantui/react"

import { panels } from "@/components/panel-registry"

export default function MapRegistryPage() {
  return <PliantRoot surface="map-registry">{panels.get("panel")}</PliantRoot>
}
