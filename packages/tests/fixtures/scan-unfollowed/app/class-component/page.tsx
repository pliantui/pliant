import * as React from "react"

import { PliantRoot } from "@pliantui/react"

import { Banner } from "@/components/banner"

class Panel extends React.Component {
  render() {
    return React.createElement(Banner)
  }
}

export default function ClassComponentPage() {
  return (
    <PliantRoot surface="class-component">
      <Panel />
    </PliantRoot>
  )
}
