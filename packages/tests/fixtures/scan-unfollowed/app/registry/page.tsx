import { PliantRoot } from "@pliantui/react"

import { Banner } from "@/components/banner"

const registry = { banner: Banner }

function Panel({ name }: { name: "banner" }) {
  const Component = registry[name]
  return <Component />
}

export default function RegistryPage() {
  return (
    <PliantRoot surface="registry">
      <Panel name="banner" />
    </PliantRoot>
  )
}
