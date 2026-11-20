import { act, cleanup, render, screen, within } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"

import { PliantRoot } from "./pliant-root"
import type { StorageAdapter, StoredLayers } from "./storage-adapter"
import { usePliantNodeProps } from "./use-pliant-node-props"

function Node() {
  return <div role="region" {...usePliantNodeProps("orders-table")} />
}

afterEach(() => {
  cleanup()
})

describe("usePliantNodeProps", () => {
  it("marks the node pending until the layers load", async () => {
    let resolve: (value: StoredLayers) => void = () => undefined
    const storage: StorageAdapter = {
      load: () =>
        new Promise((done) => {
          resolve = done
        }),
      save: () => undefined,
    }
    render(
      <PliantRoot surface="/orders" storage={storage}>
        <Node />
      </PliantRoot>
    )
    const node = screen.getByRole("region")
    expect(node.getAttribute("data-pliant-id")).toBe("orders-table")
    expect(node.getAttribute("data-pliant-pending")).toBe("")

    await act(async () => {
      resolve({})
      await Promise.resolve()
    })

    expect(node.hasAttribute("data-pliant-pending")).toBe(false)
  })

  it("is pending on the server", () => {
    const container = document.createElement("div")
    container.innerHTML = renderToString(
      <PliantRoot surface="/orders">
        <Node />
      </PliantRoot>
    )

    const node = within(container).getByRole("region")
    expect(node.getAttribute("data-pliant-id")).toBe("orders-table")
    expect(node.getAttribute("data-pliant-pending")).toBe("")
  })
})
