import * as React from "react"

export function Loader({ children }: { children: () => React.ReactNode }) {
  return <div>{children()}</div>
}
