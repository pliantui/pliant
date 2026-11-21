import type { ReactNode } from "react"
import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { localAdapter } from "./local-adapter"
import type { PliantMessages } from "./pliant-messages"
import { PliantRoot } from "./pliant-root"
import { usePliantMessages } from "./use-pliant-messages"

const defaults: Pick<PliantMessages, "pointModeOn" | "askPreviewFailed"> = {
  pointModeOn: "On",
  askPreviewFailed: (error) => `Failed: ${error}`,
}

function rootWith(messages: Partial<PliantMessages> | undefined) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <PliantRoot surface="/orders" storage={localAdapter} messages={messages}>
        {children}
      </PliantRoot>
    )
  }
}

afterEach(() => {
  cleanup()
})

describe("usePliantMessages", () => {
  it("returns the defaults outside a PliantRoot", () => {
    const { result } = renderHook(() => usePliantMessages(defaults))

    expect(result.current.pointModeOn).toBe("On")
    expect(result.current.askPreviewFailed("bad op")).toBe("Failed: bad op")
  })

  it("returns the defaults when the root has no messages", () => {
    const { result } = renderHook(() => usePliantMessages(defaults), {
      wrapper: rootWith(undefined),
    })

    expect(result.current.pointModeOn).toBe("On")
  })

  it("puts the root's messages in place of the defaults they name", () => {
    const { result } = renderHook(() => usePliantMessages(defaults), {
      wrapper: rootWith({
        askPreviewFailed: (error) => `Échec : ${error}`,
      }),
    })

    expect(result.current.pointModeOn).toBe("On")
    expect(result.current.askPreviewFailed("bad op")).toBe("Échec : bad op")
  })

  it("keeps the same object until the messages change", () => {
    const messages = { pointModeOn: "Activé" }
    let wrapper = rootWith(messages)
    const { result, rerender } = renderHook(() => usePliantMessages(defaults), {
      wrapper: ({ children }) => wrapper({ children }),
    })
    const first = result.current

    rerender()
    expect(result.current).toBe(first)

    wrapper = rootWith({ pointModeOn: "Allumé" })
    rerender()
    expect(result.current).not.toBe(first)
    expect(result.current.pointModeOn).toBe("Allumé")
  })

  it("keeps the default of an entry set to undefined", () => {
    const { result } = renderHook(() => usePliantMessages(defaults), {
      // Apps without `exactOptionalPropertyTypes` can pass this.
      wrapper: rootWith({
        pointModeOn: undefined,
        askPreviewFailed: undefined,
      } as unknown as Partial<PliantMessages>),
    })

    expect(result.current.pointModeOn).toBe("On")
    expect(result.current.askPreviewFailed("bad op")).toBe("Failed: bad op")
  })

  it("uses the outer root's messages in a root without its own", () => {
    const { result } = renderHook(() => usePliantMessages(defaults), {
      wrapper: ({ children }) => (
        <PliantRoot
          surface="/outer"
          storage={localAdapter}
          messages={{ pointModeOn: "Activé" }}
        >
          <PliantRoot surface="/inner" storage={localAdapter}>
            {children}
          </PliantRoot>
        </PliantRoot>
      ),
    })

    expect(result.current.pointModeOn).toBe("Activé")
  })
})
