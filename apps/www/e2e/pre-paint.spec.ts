import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

const surface = "/examples/orders"
const id = "01KAB0000000000000000000P1"
const baseOrder = ["revenue", "orders", "average-order-value", "overdue"]
const moveOverdueFirst = {
  op: "move",
  target: "key-metrics/slots/overdue",
  to: { index: 0 },
}

function recordOf(ops: unknown[], { deleted = false } = {}) {
  return {
    overlay: {
      v: 1,
      id,
      surface,
      layer: "personal",
      ops,
      basis: { contract: 1, core: "0.0.0", manifests: {} },
      source: "manual",
      createdBy: "local",
      createdAt: "2026-11-19T00:00:00.000Z",
    },
    etag: "1",
    version: 1,
    updatedAt: "2026-11-19T00:00:00.000Z",
    ...(deleted && { deletedAt: "2026-11-19T00:00:00.000Z" }),
  }
}

async function store(
  page: Page,
  area: "localStorage" | "sessionStorage",
  key: string,
  value: unknown
) {
  await page.addInitScript(
    ([area, key, value]) => {
      window[area].setItem(key, JSON.stringify(value))
    },
    [area, key, value] as const
  )
}

function seed(page: Page, ops: unknown[], options?: { deleted?: boolean }) {
  return store(
    page,
    "localStorage",
    `pliant:${surface}:${id}`,
    recordOf(ops, options)
  )
}

// The page as the browser paints it before React hydrates: the scripts that
// hydrate it never load.
async function loadUnhydrated(page: Page) {
  await page.route(/\/_next\/static\/chunks\/.+\.js$/, (route) => route.abort())
  await page.goto(surface)
}

function keyMetrics(page: Page) {
  return page.locator('[data-pliant-id="key-metrics"]')
}

function card(page: Page, name: string) {
  return page.getByRole("group", { name, exact: true })
}

async function hasSkeleton(page: Page) {
  return keyMetrics(page).evaluate(
    (region) => getComputedStyle(region).backgroundColor !== "rgba(0, 0, 0, 0)"
  )
}

test.describe("before the page hydrates", () => {
  test("shows a user with no overlays the page as rendered", async ({
    page,
  }) => {
    await loadUnhydrated(page)

    await expect(card(page, "Revenue")).toBeVisible()
    await expect(page.getByRole("table", { name: "All orders" })).toBeVisible()
    expect(await hasSkeleton(page)).toBe(false)
  })

  test("shows a skeleton in place of a customized region only", async ({
    page,
  }) => {
    await seed(page, [moveOverdueFirst])
    await loadUnhydrated(page)

    await expect(card(page, "Revenue")).toBeHidden()
    await expect(card(page, "Overdue")).toBeHidden()
    expect(await hasSkeleton(page)).toBe(true)
    await expect(page.getByRole("table", { name: "All orders" })).toBeVisible()
  })

  test("shows a skeleton in place of a customized table only", async ({
    page,
  }) => {
    await seed(page, [
      {
        op: "setSort",
        target: "orders-table",
        sort: [{ field: "value", dir: "desc" }],
      },
    ])
    await loadUnhydrated(page)

    await expect(page.getByRole("table", { name: "All orders" })).toBeHidden()
    await expect(card(page, "Revenue")).toBeVisible()
    expect(await hasSkeleton(page)).toBe(false)
  })

  test("reads overlays stored for every surface", async ({ page }) => {
    await store(
      page,
      "localStorage",
      `pliant:@app:${id}`,
      recordOf([moveOverdueFirst])
    )
    await loadUnhydrated(page)

    await expect(card(page, "Revenue")).toBeHidden()
  })

  test("reads the session layer", async ({ page }) => {
    await store(page, "sessionStorage", `pliant:session:${surface}`, {
      v: 1,
      overlays: [{ ...recordOf([moveOverdueFirst]).overlay, layer: "session" }],
      preview: null,
    })
    await loadUnhydrated(page)

    await expect(card(page, "Revenue")).toBeHidden()
  })

  test("ignores removed overlays and other surfaces", async ({ page }) => {
    await seed(page, [moveOverdueFirst], { deleted: true })
    await store(
      page,
      "localStorage",
      `pliant:/examples/other:${id}`,
      recordOf([moveOverdueFirst])
    )
    await loadUnhydrated(page)

    await expect(card(page, "Revenue")).toBeVisible()
    expect(await hasSkeleton(page)).toBe(false)
  })

  test("ignores a target that isn't a node address", async ({ page }) => {
    await seed(page, [
      // Would close the selector and hide everything, if it were used.
      { op: "hide", target: 'x"]),*{visibility:hidden}:is([x="' },
    ])
    await loadUnhydrated(page)

    await expect(card(page, "Revenue")).toBeVisible()
    await expect(page.getByRole("table", { name: "All orders" })).toBeVisible()
  })
})

declare global {
  interface Window {
    // The order of the key metrics each frame showed, before it painted.
    paintedFrames?: string[][]
  }
}

// Records, at every animation frame from the first one, which key metrics
// the frame is about to paint, in order.
function recordFrames() {
  window.paintedFrames = []
  const record = () => {
    const region = document.querySelector('[data-pliant-id="key-metrics"]')
    if (region) {
      window.paintedFrames?.push(
        [...region.querySelectorAll(":scope > [data-pliant-id]")]
          .filter((slot) =>
            slot.firstElementChild?.checkVisibility({
              visibilityProperty: true,
            })
          )
          .map((slot) => slot.getAttribute("data-pliant-id") ?? "")
      )
    }
    requestAnimationFrame(record)
  }
  requestAnimationFrame(record)
}

async function framesOf(page: Page) {
  await expect(keyMetrics(page)).not.toHaveAttribute("data-pliant-pending")
  // Two more frames, so the last one recorded is after the layers applied.
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      })
  )
  return page.evaluate(() => window.paintedFrames ?? [])
}

test("never paints the base order to a customized user", async ({
  page,
  errors,
}) => {
  await seed(page, [moveOverdueFirst])
  await page.addInitScript(recordFrames)
  await page.goto(surface)

  const frames = await framesOf(page)
  const painted = frames.filter((frame) => frame.length > 0)
  expect(painted.length).toBeGreaterThan(0)
  for (const frame of painted) {
    expect(frame).toEqual([
      "overdue",
      "revenue",
      "orders",
      "average-order-value",
    ])
  }
  expect(errors).toEqual([])
})

test("never shows a skeleton to a user with no overlays", async ({
  page,
  errors,
}) => {
  await page.addInitScript(recordFrames)
  await page.goto(surface)

  const frames = await framesOf(page)
  expect(frames.length).toBeGreaterThan(0)
  for (const frame of frames) {
    expect(frame).toEqual(baseOrder)
  }
  expect(errors).toEqual([])
})
