import { orders } from "../app/(examples)/examples/orders/data"
import {
  formatCurrency,
  formatDate,
} from "../app/(examples)/examples/orders/format"
import { getOrderStats } from "../app/(examples)/examples/orders/stats"
import { expect, test } from "./fixtures"

const pageSize = 10
const byValue = [...orders].sort((a, b) => a.value - b.value)
const lowest = byValue[0]
const highest = byValue[byValue.length - 1]

test.beforeEach(async ({ page }) => {
  await page.goto("/examples/orders")
  await page.waitForLoadState("networkidle")
})

test("renders without console errors", async ({ page, errors }) => {
  await expect(
    page.getByRole("heading", { level: 1, name: "Orders" })
  ).toBeVisible()
  await expect(page.getByRole("table")).toBeVisible()
  expect(errors).toEqual([])
})

test("shows KPIs computed from the fixture", async ({ page }) => {
  const stats = getOrderStats(orders)
  const expected = {
    Revenue: formatCurrency(stats.revenue),
    Orders: stats.orders.toLocaleString("en-IN"),
    "Average order value": formatCurrency(stats.averageOrderValue),
    Overdue: stats.overdue.toLocaleString("en-IN"),
  }
  for (const [label, value] of Object.entries(expected)) {
    await expect(page.getByRole("group", { name: label })).toContainText(value)
  }
})

test("renders every column of the first order", async ({ page }) => {
  const first = orders[0]
  const row = page.getByRole("row").nth(1)
  await expect(row).toContainText(first?.id ?? "")
  await expect(row).toContainText(first?.customer ?? "")
  await expect(row).toContainText(first?.region ?? "")
  await expect(row).toContainText(first?.status ?? "")
  await expect(row).toContainText(formatCurrency(first?.value ?? 0))
  await expect(row).toContainText(formatDate(first?.createdAt ?? ""))
})

test("sorts by value", async ({ page }) => {
  const header = page.getByRole("columnheader", { name: "Value" })
  const firstRow = page.getByRole("row").nth(1)

  await header.getByRole("button").click()
  await expect(header).toHaveAttribute("aria-sort", "ascending")
  await expect(firstRow).toContainText(lowest?.id ?? "")

  await header.getByRole("button").click()
  await expect(header).toHaveAttribute("aria-sort", "descending")
  await expect(firstRow).toContainText(highest?.id ?? "")
})

test("paginates", async ({ page }) => {
  const previous = page.getByRole("button", { name: "Previous" })
  const next = page.getByRole("button", { name: "Next" })
  const rows = page.getByRole("row")

  await expect(rows).toHaveCount(pageSize + 1)
  await expect(previous).toBeDisabled()
  await expect(
    page.getByText(`1-${String(pageSize)} of ${String(orders.length)} orders`)
  ).toBeVisible()

  await next.click()
  await expect(rows.nth(1)).toContainText(orders[pageSize]?.id ?? "")
  await expect(previous).toBeEnabled()
  await expect(
    page.getByText(
      `${String(pageSize + 1)}-${String(pageSize * 2)} of ${String(orders.length)} orders`
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

  await expect(page.getByRole("columnheader", { name: "Notes" })).toHaveCount(0)
  await expect(page.getByRole("columnheader")).toHaveCount(6)
})
