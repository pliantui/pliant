import type { Locator, Page } from "@playwright/test"

import { expect, test } from "./fixtures"

const surface = "/examples/orders"

async function seed(page: Page, ops: unknown[]) {
  await page.addInitScript(
    ({ key, overlay }) => {
      const record = {
        overlay,
        etag: "1",
        version: 1,
        updatedAt: "2026-11-19T00:00:00.000Z",
      }
      localStorage.setItem(key, JSON.stringify({ v: 1, personal: [record] }))
    },
    {
      key: `pliant:${surface}`,
      overlay: {
        v: 1,
        id: "01KAB0000000000000000000P1",
        surface,
        layer: "personal",
        ops,
        basis: { contract: 1, core: "0.0.0", manifests: {} },
        source: "manual",
        createdBy: "local",
        createdAt: "2026-11-19T00:00:00.000Z",
      },
    }
  )
}

function region(page: Page) {
  return page.locator('[data-pliant-id="key-metrics"]')
}

async function load(page: Page, ops: unknown[] = []) {
  if (ops.length) {
    await seed(page, ops)
  }
  await page.goto(surface)
  await expect(region(page)).not.toHaveAttribute("data-pliant-pending")
}

function card(page: Page, name: string) {
  return page.getByRole("group", { name, exact: true })
}

async function boxOf(locator: Locator) {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error("No bounding box")
  }
  return box
}

async function boxes(page: Page) {
  return {
    revenue: await boxOf(card(page, "Revenue")),
    orders: await boxOf(card(page, "Orders")),
    average: await boxOf(card(page, "Average order value")),
    overdue: await boxOf(card(page, "Overdue")),
  }
}

type Box = Awaited<ReturnType<typeof boxOf>>

function expectSideBySide(left: Box, right: Box) {
  expect(right.y).toBe(left.y)
  expect(right.x).toBeGreaterThanOrEqual(left.x + left.width)
}

function expectBelow(top: Box, bottom: Box) {
  expect(bottom.y).toBeGreaterThanOrEqual(top.y + top.height)
}

function expectStacked(top: Box, bottom: Box) {
  expectBelow(top, bottom)
  expect(bottom.x).toBe(top.x)
}

// The cards aren't focusable on their own, so every card, hidden ones
// included, is made tabbable to check that keyboard order follows the cards'
// order and skips hidden cards.
async function expectTabOrder(page: Page, expected: readonly string[]) {
  await region(page)
    .getByRole("group", { includeHidden: true })
    .evaluateAll((elements) => {
      for (const element of elements) {
        element.setAttribute("tabindex", "0")
      }
    })
  await page
    .getByRole("region", { name: "Key metrics" })
    .evaluate((section) => {
      section.setAttribute("tabindex", "-1")
      section.focus()
    })
  for (const label of expected) {
    await page.keyboard.press("Tab")
    await expect(card(page, label)).toBeFocused()
  }
}

async function slotOrder(page: Page) {
  return region(page)
    .locator(":scope > [data-pliant-id]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-pliant-id"))
    )
}

test("renders the key metrics in their base order, in one row", async ({
  page,
  errors,
}) => {
  await load(page)

  expect(await slotOrder(page)).toEqual([
    "revenue",
    "orders",
    "average-order-value",
    "overdue",
  ])
  const box = await boxes(page)
  expectSideBySide(box.revenue, box.orders)
  expectSideBySide(box.orders, box.average)
  expectSideBySide(box.average, box.overdue)
  expect(errors).toEqual([])
})

test("reorders the key metrics in DOM, visual and tab order", async ({
  page,
  errors,
}) => {
  await load(page, [
    { op: "move", target: "key-metrics/slots/overdue", to: { index: 0 } },
  ])

  expect(await slotOrder(page)).toEqual([
    "overdue",
    "revenue",
    "orders",
    "average-order-value",
  ])
  const box = await boxes(page)
  expectSideBySide(box.overdue, box.revenue)
  expectSideBySide(box.revenue, box.orders)
  expectSideBySide(box.orders, box.average)
  await expectTabOrder(page, [
    "Overdue",
    "Revenue",
    "Orders",
    "Average order value",
  ])
  expect(errors).toEqual([])
})

test("hides a key metric from view and from the tab order", async ({
  page,
  errors,
}) => {
  await load(page, [{ op: "hide", target: "key-metrics/slots/overdue" }])

  await expectTabOrder(page, ["Revenue", "Orders", "Average order value"])
  await page.keyboard.press("Tab")
  expect(
    await region(page).evaluate((element) =>
      element.contains(document.activeElement)
    )
  ).toBe(false)
  await expect(card(page, "Overdue")).toBeHidden()
  await expect(card(page, "Revenue")).toBeVisible()
  expect(errors).toEqual([])
})

test("lays the key metrics out in a two-column grid", async ({
  page,
  errors,
}) => {
  await load(page, [
    { op: "setLayout", target: "key-metrics", mode: "grid", columns: 2 },
  ])

  const box = await boxes(page)
  expectSideBySide(box.revenue, box.orders)
  expectSideBySide(box.average, box.overdue)
  expectStacked(box.revenue, box.average)
  expect(errors).toEqual([])
})

test("stacks the key metrics in one column", async ({ page, errors }) => {
  await load(page, [{ op: "setLayout", target: "key-metrics", mode: "stack" }])

  const box = await boxes(page)
  expectStacked(box.revenue, box.orders)
  expectStacked(box.orders, box.average)
  expectStacked(box.average, box.overdue)
  expect(errors).toEqual([])
})

test("spans a key metric over two columns", async ({ page, errors }) => {
  await load(page, [
    { op: "span", target: "key-metrics/slots/revenue", columns: 2 },
  ])

  const box = await boxes(page)
  expect(box.revenue.width).toBeGreaterThan(2 * box.orders.width)
  expectSideBySide(box.revenue, box.orders)
  expectSideBySide(box.orders, box.average)
  expectBelow(box.revenue, box.overdue)
  expect(errors).toEqual([])
})

test("lays out wrapped key metrics as a grid across the region", async ({
  page,
  errors,
}) => {
  await load(page, [
    {
      op: "wrap",
      target: "key-metrics",
      id: "money",
      items: ["revenue", "overdue"],
      mode: "grid",
      columns: 2,
    },
  ])

  const box = await boxes(page)
  expectSideBySide(box.revenue, box.overdue)
  expect(box.revenue.width).toBeGreaterThan(box.orders.width)
  expectBelow(box.revenue, box.orders)
  expectSideBySide(box.orders, box.average)
  expect(errors).toEqual([])
})

test("keeps a stacked wrapper one column wide", async ({ page, errors }) => {
  await load(page, [
    {
      op: "wrap",
      target: "key-metrics",
      id: "money",
      items: ["revenue", "overdue"],
      mode: "row",
    },
    { op: "setLayout", target: "money", mode: "stack", at: "lg" },
  ])

  const box = await boxes(page)
  expectStacked(box.revenue, box.overdue)
  expect(box.revenue.width).toBeCloseTo(box.orders.width, 0)
  expectSideBySide(box.revenue, box.orders)
  expect(errors).toEqual([])
})

test("spans a wrapper over the columns its span sets", async ({
  page,
  errors,
}) => {
  await load(page, [
    {
      op: "wrap",
      target: "key-metrics",
      id: "money",
      items: ["revenue", "overdue"],
      mode: "grid",
      columns: 2,
    },
    { op: "span", target: "key-metrics/slots/money", columns: 2 },
  ])

  const box = await boxes(page)
  const whole = await boxOf(region(page))
  const wrapperWidth = box.overdue.x + box.overdue.width - box.revenue.x
  expectSideBySide(box.revenue, box.overdue)
  expect(wrapperWidth).toBeGreaterThan(2 * box.orders.width)
  expect(wrapperWidth).toBeLessThan(whole.width - box.orders.width)
  expectSideBySide(box.overdue, box.orders)
  expect(errors).toEqual([])
})

test("collapses key metrics behind a More control", async ({
  page,
  errors,
}) => {
  await load(page, [
    {
      op: "collapse",
      target: "key-metrics",
      items: ["average-order-value", "overdue"],
      into: "more",
    },
  ])
  const more = region(page).getByRole("button", { name: "More" })

  await expect(more).toHaveAttribute("aria-expanded", "false")
  await expect(card(page, "Average order value")).toBeHidden()
  await expect(card(page, "Overdue")).toBeHidden()
  await expect(card(page, "Revenue")).toBeVisible()

  await more.click()
  await expect(more).toHaveAttribute("aria-expanded", "true")
  const box = await boxes(page)
  expectSideBySide(box.revenue, box.orders)
  expectSideBySide(box.average, box.overdue)
  expectBelow(await boxOf(more), box.average)

  await more.click()
  await expect(card(page, "Overdue")).toBeHidden()
  expect(errors).toEqual([])
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("keeps one column unless a layout targets phones", async ({
    page,
    errors,
  }) => {
    await load(page, [
      { op: "setLayout", target: "key-metrics", mode: "grid", columns: 2 },
    ])

    const box = await boxes(page)
    expectStacked(box.revenue, box.orders)
    expect(errors).toEqual([])
  })

  test("lays out two columns when a layout targets phones", async ({
    page,
    errors,
  }) => {
    await load(page, [
      {
        op: "setLayout",
        target: "key-metrics",
        mode: "grid",
        columns: 2,
        at: "base",
      },
    ])

    const box = await boxes(page)
    expectSideBySide(box.revenue, box.orders)
    expectBelow(box.revenue, box.average)
    expect(errors).toEqual([])
  })
})
