import type { Page } from "@playwright/test"

import { orders } from "../lib/demo/data"
import { formatCurrency, formatDate, formatNumber } from "../lib/demo/format"
import { getOrderStats } from "../lib/demo/stats"
import { expect, test } from "./fixtures"

const pageSize = 10
const values = orders.map((order) => order.value)
const [first] = orders
if (!first) throw new Error("The fixture has no orders")

const lowest = Math.min(...values)
const highest = Math.max(...values)

test.beforeEach(async ({ page }) => {
  await page.goto("/examples/orders")
})

async function visibleValues(page: Page) {
  const headers = await page.getByRole("columnheader").allTextContents()
  const column = headers.findIndex((header) => header.includes("Value"))
  const cells = await page
    .getByRole("row")
    .locator(`td:nth-child(${String(column + 1)})`)
    .allTextContents()
  return cells.map((cell) => Number(cell.replace(/\D/g, "")))
}

function isOrdered(
  shown: number[],
  inOrder: (a: number, b: number) => boolean
) {
  return shown.every((value, index) => {
    const previous = shown[index - 1]
    return previous === undefined || inOrder(previous, value)
  })
}

test("renders without console errors", async ({ page, errors }) => {
  await expect(
    page.getByRole("heading", { level: 2, name: "Orders", exact: true })
  ).toBeVisible()
  await expect(page.getByRole("table", { name: "All orders" })).toBeVisible()
  expect(errors).toEqual([])
})

test("shows KPIs computed from the fixture", async ({ page }) => {
  const stats = getOrderStats(orders)
  const expected = {
    Revenue: formatCurrency(stats.revenue),
    Orders: formatNumber(stats.orders),
    "Average order value": formatCurrency(stats.averageOrderValue),
    Overdue: formatNumber(stats.overdue),
  }
  for (const [label, value] of Object.entries(expected)) {
    await expect(page.getByRole("group", { name: label })).toContainText(value)
  }
})

test("renders every column of the first order", async ({ page }) => {
  const row = page.getByRole("row").nth(1)
  await expect(row).toContainText(first.id)
  await expect(row).toContainText(first.customer)
  await expect(row).toContainText(first.region)
  await expect(row).toContainText(first.status)
  await expect(row).toContainText(formatCurrency(first.value))
  await expect(row).toContainText(formatDate(first.createdAt))
  await expect(row).toContainText(first.notes || "No notes")
})

test("sorts by value", async ({ page }) => {
  const header = page.getByRole("columnheader", { name: "Value" })

  await header.getByRole("button").click()
  await expect(header).toHaveAttribute("aria-sort", "ascending")
  await expect
    .poll(async () => {
      const shown = await visibleValues(page)
      return shown[0] === lowest && isOrdered(shown, (a, b) => a <= b)
    })
    .toBe(true)

  await header.getByRole("button").click()
  await expect(header).toHaveAttribute("aria-sort", "descending")
  await expect
    .poll(async () => {
      const shown = await visibleValues(page)
      return shown[0] === highest && isOrdered(shown, (a, b) => a >= b)
    })
    .toBe(true)
})

test("paginates", async ({ page }) => {
  const previous = page.getByRole("button", { name: "Previous" })
  const next = page.getByRole("button", { name: "Next" })
  const rows = page.getByRole("row")
  const total = formatNumber(orders.length)

  await expect(rows).toHaveCount(pageSize + 1)
  await expect(previous).toBeDisabled()
  await expect(
    page.getByText(`1–${String(pageSize)} of ${total}`)
  ).toBeVisible()

  await next.click()
  await expect(rows.nth(1)).toContainText(orders[pageSize]?.id ?? "")
  await expect(previous).toBeEnabled()
  await expect(
    page.getByText(
      `${String(pageSize + 1)}–${String(pageSize * 2)} of ${total}`
    )
  ).toBeVisible()

  await previous.click()
  await expect(rows.nth(1)).toContainText(orders[0]?.id ?? "")
})

test("hides a column", async ({ page }) => {
  await expect(page.getByRole("columnheader", { name: "Notes" })).toBeVisible()

  await page.getByRole("button", { name: "Columns" }).click()
  await page.getByRole("menuitemcheckbox", { name: "Notes" }).click()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("menu")).toBeHidden()

  await expect(page.getByRole("columnheader", { name: "Notes" })).toHaveCount(0)
  await expect(page.getByRole("columnheader")).toHaveCount(6)
})
