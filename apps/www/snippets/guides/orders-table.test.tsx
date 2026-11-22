// @vitest-environment happy-dom
// #region test
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, expect, it } from "vitest"

import {
  PliantRoot,
  type StorageAdapter,
  type StoredOverlay,
} from "@pliantui/react"

import { orders } from "../first-table/data"
import { OrdersTable } from "../first-table/orders-table"

// Keeps saved overlays in memory, so each test starts empty.
function memoryAdapter(): StorageAdapter & { saved: StoredOverlay[] } {
  const saved: StoredOverlay[] = []
  return {
    saved,
    load: () => ({ personal: [...saved] }),
    save: (_surface, overlay) => {
      const record = {
        overlay,
        etag: String(saved.length + 1),
        version: 1,
        updatedAt: new Date().toISOString(),
      }
      saved.push(record)
      return record
    },
  }
}

function renderPage(storage: StorageAdapter) {
  return render(
    <PliantRoot surface="/orders" storage={storage}>
      <OrdersTable data={orders} />
    </PliantRoot>
  )
}

afterEach(cleanup)

it("remembers the user's sort after a reload", async () => {
  const storage = memoryAdapter()
  const page = renderPage(storage)

  const value = await screen.findByRole("button", { name: "Value" })
  fireEvent.click(value)
  fireEvent.click(value)
  await waitFor(
    () => {
      expect(storage.saved).not.toHaveLength(0)
    },
    { timeout: 3000 }
  )

  page.unmount()
  renderPage(storage)

  const header = await screen.findByRole("columnheader", { name: "Value" })
  expect(header.getAttribute("aria-sort")).toBe("descending")
})
// #endregion test
