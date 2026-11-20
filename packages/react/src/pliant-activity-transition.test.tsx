import * as React from "react"
import {
  startTransition,
  useLayoutEffect,
  useState,
  ViewTransition,
  type ReactNode,
} from "react"
import { createRoot } from "react-dom/client"
import { afterEach, expect, it, vi } from "vitest"

import type { LayerStore } from "./layer-store"
import { PliantActivity } from "./pliant-activity"
import { useLayerStore } from "./pliant-context"
import { PliantRoot } from "./pliant-root"
import { useRegionSlots } from "./use-region-slots"

let store: LayerStore | undefined
let setTab: (tab: "a" | "b") => void = () => undefined

function Store() {
  const current = useLayerStore("Store")
  useLayoutEffect(() => {
    store = current
  }, [current])
  return null
}

const aSlots = { "card-a": "A" }
const bSlots = { "card-b": "B" }

function Region({
  id,
  slots,
}: {
  id: string
  slots: Record<string, ReactNode>
}) {
  useRegionSlots(id, slots)
  return null
}

function App() {
  const [tab, set] = useState<"a" | "b">("a")
  useLayoutEffect(() => {
    setTab = set
  }, [])
  return (
    <PliantRoot surface="/dashboard">
      <Store />
      <ViewTransition>
        <div>
          <PliantActivity mode={tab === "a" ? "visible" : "hidden"}>
            <Region id="region-a" slots={aSlots} />
          </PliantActivity>
          <PliantActivity mode={tab === "b" ? "visible" : "hidden"}>
            <Region id="region-b" slots={bSlots} />
          </PliantActivity>
        </div>
      </ViewTransition>
    </PliantRoot>
  )
}

function wait() {
  return new Promise((resolve) => setTimeout(resolve, 20))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  Reflect.deleteProperty(document, "fonts")
  Reflect.deleteProperty(document, "startViewTransition")
})

// A view transition waiting on fonts defers the layout phase of the commit
// that shows region-a past a microtask. ViewTransition ships in React 19.3, so
// earlier supported releases have no such deferral to test.
it.skipIf(!("ViewTransition" in React))(
  "keeps a region registered while a view transition defers showing it",
  async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", false)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    let fontsLoading = false
    let reads = 0
    let loadFonts: () => void = () => undefined
    const ready = new Promise<void>((resolve) => {
      loadFonts = resolve
    })
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        get status() {
          return fontsLoading && reads++ > 0 ? "loading" : "loaded"
        },
        ready,
      },
    })
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: ({ update }: { update: () => unknown }) => {
        const done = Promise.resolve().then(update)
        return {
          ready: done.then(() => undefined),
          finished: done.then(() => undefined),
          updateCallbackDone: done,
          skipTransition: () => undefined,
          types: new Set(),
        }
      },
    })
    Object.defineProperty(document.documentElement, "getAnimations", {
      configurable: true,
      value: () => [],
    })

    const container = document.createElement("div")
    document.body.append(container)
    const root = createRoot(container)
    root.render(<App />)
    await wait()
    startTransition(() => {
      setTab("b")
    })
    await wait()
    expect(store?.slots.getContent("card-a")).toBe("A")

    const seen: unknown[] = []
    store?.slots.subscribe("card-a", () => {
      seen.push(store?.slots.getContent("card-a"))
    })
    fontsLoading = true
    startTransition(() => {
      setTab("a")
    })
    await wait()
    expect(store?.slots.getContent("card-a")).toBe("A")
    loadFonts()
    await wait()

    expect(store?.slots.getContent("card-a")).toBe("A")
    expect(seen).not.toContain(undefined)
    root.unmount()
    container.remove()
  }
)
