import { PliantRoot } from "@pliantui/react"

import Notes from "@/content/notes.mdx"

export default function MdxModulePage() {
  return (
    <PliantRoot surface="mdx-module">
      <Notes />
    </PliantRoot>
  )
}
