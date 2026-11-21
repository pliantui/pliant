import * as React from "react"

import { PliantRoot } from "@pliantui/react"

import { renderBanner } from "@/components/helpers"

const Content = React.createContext<React.ReactNode>(null)

function Show() {
  return <div>{React.useContext(Content)}</div>
}

function Panel() {
  return (
    <Content.Provider value={renderBanner()}>
      <Show />
    </Content.Provider>
  )
}

export default function ContextValuePage() {
  return (
    <PliantRoot surface="context-value">
      <Panel />
    </PliantRoot>
  )
}
