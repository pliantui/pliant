// @vitest-environment happy-dom
import * as React from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import type { Op } from "@pliantui/contract"
import {
  PliantRoot,
  useMountedNodes,
  usePliantStore,
  type StorageAdapter,
} from "@pliantui/react"

import { CustomizedReset } from "./customized-reset"

const surface = "/demo"

const storage: StorageAdapter = {
  load: () => ({ personal: [] }),
  save: (_surface, overlay) => ({
    overlay,
    etag: crypto.randomUUID(),
    version: 1,
    updatedAt: new Date().toISOString(),
  }),
  remove: () => undefined,
}

const sortByValue = (target: string): Op => ({
  op: "setSort",
  target,
  sort: [{ field: "value", dir: "desc" }],
})

const nodeIds = ["orders-table", "orders-tablex", "page", "notes"]

type Store = ReturnType<typeof usePliantStore>

let store: Store | undefined

function Nodes({ onStore }: { onStore: (store: Store) => void }) {
  useMountedNodes(nodeIds)
  const current = usePliantStore()
  React.useEffect(() => {
    onStore(current)
  }, [current, onStore])
  return null
}

function keepStore(current: Store) {
  store = current
}

async function renderReset() {
  render(
    <PliantRoot surface={surface} storage={storage}>
      <Nodes onStore={keepStore} />
      <CustomizedReset targets={["orders-table"]} label="the orders table" />
    </PliantRoot>
  )
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  expect(store).toBeDefined()
}

function reset() {
  return screen.getByRole("button", { name: "Reset the orders table" })
}

afterEach(() => {
  cleanup()
  store = undefined
})

describe("CustomizedReset", () => {
  it("shows nothing to reset before the user changes anything", async () => {
    await renderReset()

    expect(screen.queryByText("Customized")).toBeNull()
    expect(reset().getAttribute("aria-disabled")).toBe("true")
  })

  it("counts a preview only once it's locked in, and resets it", async () => {
    await renderReset()

    act(() => {
      store?.preview({
        v: 1,
        id: "01KAB0000000000000000000S1",
        surface,
        ops: [sortByValue("orders-table")],
        basis: { contract: 1, core: "0.0.0", manifests: {} },
        source: "ai",
        explain: ["Sorted by value."],
        createdBy: "anonymous",
        createdAt: new Date().toISOString(),
        layer: "session",
      })
    })
    expect(screen.queryByText("Customized")).toBeNull()

    act(() => {
      store?.lockIn()
    })
    expect(screen.getByText("Customized")).toBeTruthy()

    fireEvent.click(reset())
    expect(screen.queryByText("Customized")).toBeNull()
    expect(reset().getAttribute("aria-disabled")).toBe("true")
  })

  it("ignores changes to other nodes, even ones with a similar id", async () => {
    await renderReset()

    act(() => {
      store?.applyOps("personal", [sortByValue("orders-tablex")])
    })
    expect(screen.queryByText("Customized")).toBeNull()

    act(() => {
      store?.applyOps("personal", [sortByValue("orders-table")])
    })
    expect(screen.getByText("Customized")).toBeTruthy()
  })

  it("counts a slot addressed through the node, as Reset does", async () => {
    await renderReset()

    act(() => {
      store?.applyOps("personal", [
        { op: "hide", target: "page/slots/orders-table/slots/notes" },
      ])
    })
    expect(screen.getByText("Customized")).toBeTruthy()

    fireEvent.click(reset())
    expect(screen.queryByText("Customized")).toBeNull()
  })
})
