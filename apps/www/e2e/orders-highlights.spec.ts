import type { Page } from "@playwright/test"

import { orders } from "../lib/demo/data"
import { formatCurrency } from "../lib/demo/format"
import { expect, test } from "./fixtures"

function node(page: Page) {
  return page.locator('[data-pliant-id="orders-table"]')
}

function table(page: Page) {
  return page.getByRole("table", { name: "All orders" })
}

function bodyRows(page: Page) {
  return table(page).locator("tbody tr")
}

async function load(page: Page) {
  await page.goto("/examples/orders")
  await expect(node(page)).not.toHaveAttribute("data-pliant-pending")
}

async function toggleHighlight(page: Page, name: string) {
  await page.getByRole("button", { name: "Highlight" }).click()
  await page.getByRole("menuitemcheckbox", { name }).click()
  await expect(page.getByRole("menu")).toBeHidden()
}

// The color a row's first cell shows, its tint over its background.
function shownColor(page: Page, index: number) {
  return bodyRows(page)
    .nth(index)
    .locator("td")
    .first()
    .evaluate((cell) => {
      const style = getComputedStyle(cell)
      return `${style.backgroundColor} ${style.backgroundImage}`
    })
}

async function statuses(page: Page) {
  const headers = await table(page).getByRole("columnheader").allTextContents()
  const index = headers.indexOf("Status")
  return table(page)
    .locator(`tbody td:nth-child(${String(index + 1)})`)
    .allTextContents()
}

test("highlights overdue orders with a tint, an icon and a name", async ({
  page,
  errors,
}) => {
  await load(page)
  const shown = await statuses(page)
  const overdue = shown.findIndex((status) => /overdue/i.test(status))
  const other = shown.findIndex((status) => !/overdue/i.test(status))
  expect(overdue).toBeGreaterThanOrEqual(0)
  expect(other).toBeGreaterThanOrEqual(0)
  const plain = await shownColor(page, overdue)

  await toggleHighlight(page, "Overdue")

  const cues = bodyRows(page).getByText("Highlighted: Overdue")
  await expect(cues).toHaveCount(
    shown.filter((status) => /overdue/i.test(status)).length
  )
  const row = bodyRows(page).nth(overdue)
  await expect(row.getByText("Highlighted: Overdue")).toBeAttached()
  await expect(row.locator("svg")).toBeVisible()
  expect(await shownColor(page, overdue)).not.toBe(plain)
  expect(await shownColor(page, other)).toBe(plain)
  await expect(
    bodyRows(page)
      .nth(other)
      .getByText(/^Highlighted:/)
  ).toHaveCount(0)
  expect(errors).toEqual([])
})

test("keeps a highlight after a reload and removes it from the menu", async ({
  page,
  errors,
}) => {
  await load(page)
  await toggleHighlight(page, "Overdue")
  await page.reload()
  await expect(node(page)).not.toHaveAttribute("data-pliant-pending")
  await expect(
    bodyRows(page).getByText("Highlighted: Overdue").first()
  ).toBeAttached()
  await page.getByRole("button", { name: "Highlight" }).click()
  await expect(
    page.getByRole("menuitemcheckbox", { name: "Overdue" })
  ).toBeChecked()
  await page.keyboard.press("Escape")

  await toggleHighlight(page, "Overdue")
  await expect(bodyRows(page).getByText(/^Highlighted:/)).toHaveCount(0)
  expect(errors).toEqual([])
})

test("highlights the largest order of each group", async ({ page, errors }) => {
  await load(page)
  await toggleHighlight(page, "Largest in group")
  const sort = table(page)
    .getByRole("columnheader", { name: "Value" })
    .getByRole("button")
  await sort.click()
  await sort.click()
  await expect(
    bodyRows(page).first().getByText("Highlighted: Largest in group")
  ).toBeAttached()
  await expect(
    bodyRows(page).getByText("Highlighted: Largest in group")
  ).toHaveCount(1)

  await page.getByRole("button", { name: "Group by" }).click()
  await page.getByRole("menuitemradio", { name: "Status", exact: true }).click()
  await expect(page.getByRole("menu")).toBeHidden()
  await table(page).getByRole("button", { name: /paid/i }).click()
  const cues = bodyRows(page).getByText("Highlighted: Largest in group")
  await expect(cues).toHaveCount(1)
  const largestPaid = Math.max(
    ...orders
      .filter((order) => order.status === "paid")
      .map((order) => order.value)
  )
  await expect(
    bodyRows(page)
      .filter({ hasText: "Highlighted: Largest in group" })
      .getByRole("cell", { name: formatCurrency(largestPaid), exact: true })
  ).toBeVisible()
  expect(errors).toEqual([])
})
