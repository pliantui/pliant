import { act, cleanup, render, screen } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"

import { PliantRoot } from "./pliant-root"
import type { StorageAdapter, StoredLayers } from "./storage-adapter"
import { usePliantNode } from "./use-pliant-node"

function Node() {
  return <div role="region" {...usePliantNode("orders-table")} />
}

afterEach(() => {
  cleanup()
})

describe("usePliantNode", () => {
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
    expect(
      renderToString(
        <PliantRoot surface="/orders">
          <Node />
        </PliantRoot>
      )
    ).toBe(
      '<div role="region" data-pliant-id="orders-table" data-pliant-pending=""></div>'
    )
  })
})
