import type { Page } from "@playwright/test"

import { orders } from "../app/(examples)/examples/orders/data"
import {
  formatCurrency,
  formatNumber,
} from "../app/(examples)/examples/orders/format"
import { expect, test } from "./fixtures"

const statuses = ["paid", "pending", "overdue", "refunded"] as const
const baseHeaders = [
  "Order",
  "Customer",
  "Region",
  "Status",
  "Value",
  "Created",
  "Notes",
]

function node(page: Page) {
  return page.locator('[data-pliant-id="orders-table"]')
}

function table(page: Page) {
  return page.getByRole("table", { name: "All orders" })
}

async function load(page: Page) {
  await page.goto("/examples/orders")
  await expect(node(page)).not.toHaveAttribute("data-pliant-pending")
}

async function groupBy(page: Page, name: string) {
  await page.getByRole("button", { name: "Group by" }).click()
  await page.getByRole("menuitemradio", { name, exact: true }).click()
  await expect(page.getByRole("menu")).toBeHidden()
}

function totalOf(status: string) {
  return orders
    .filter((order) => order.status === status)
    .reduce((sum, order) => sum + order.value, 0)
}

function countOf(status: string) {
  return orders.filter((order) => order.status === status).length
}

async function headers(page: Page) {
  return table(page).getByRole("columnheader").allTextContents()
}

function groupRow(page: Page, status: string) {
  return table(page)
    .getByRole("row")
    .filter({
      has: page.getByRole("button", { name: new RegExp(status, "i") }),
    })
}

test("groups orders by status with totals", async ({ page, errors }) => {
  await load(page)
  await groupBy(page, "Status")

  expect(await headers(page)).toEqual([
    "Status",
    "Order",
    "Customer",
    "Region",
    "Value",
    "Created",
    "Notes",
    "Total value",
    "Orders",
  ])
  const body = table(page).locator("tbody").getByRole("row")
  await expect(body).toHaveCount(statuses.length)
  for (const status of statuses) {
    const row = groupRow(page, status)
    await expect(row).toContainText(formatCurrency(totalOf(status)))
    await expect(row).toContainText(`(${formatNumber(countOf(status))})`)
    await expect(row).toContainText(formatNumber(countOf(status)))
  }
  await expect(node(page).getByText(`1–4 of 4 rows`)).toBeVisible()

  const footer = table(page).locator("tfoot")
  await expect(footer).toContainText("All rows")
  await expect(footer).toContainText(
    formatCurrency(orders.reduce((sum, order) => sum + order.value, 0))
  )
  await expect(footer).toContainText(formatNumber(orders.length))

  const total = await table(page)
    .getByRole("columnheader", { name: "Total value" })
    .boundingBox()
  const cell = await groupRow(page, "paid")
    .getByText(formatCurrency(totalOf("paid")))
    .boundingBox()
  expect(cell?.x).toBeGreaterThanOrEqual(total?.x ?? Infinity)
  expect(errors).toEqual([])
})

test("expands a group to show its orders", async ({ page, errors }) => {
  await load(page)
  await groupBy(page, "Region")

  const toggle = table(page).getByRole("button", { name: /North/ })
  await expect(toggle).toHaveAttribute("aria-expanded", "false")
  await toggle.click()
  await expect(toggle).toHaveAttribute("aria-expanded", "true")

  const north = orders.filter((order) => order.region === "North")
  const body = table(page).locator("tbody").getByRole("row")
  await expect(body).toHaveCount(Math.min(north.length + 4, 10))
  await expect(
    groupRow(page, "North").locator("xpath=following-sibling::tr[1]")
  ).toContainText(north[0]?.id ?? "")
  await toggle.click()
  await expect(toggle).toHaveAttribute("aria-expanded", "false")
  await expect(body).toHaveCount(4)
  expect(errors).toEqual([])
})

test("keeps the grouping after a reload and clears it", async ({
  page,
  errors,
}) => {
  await load(page)
  await groupBy(page, "Status")
  await page.reload()
  await expect(node(page)).not.toHaveAttribute("data-pliant-pending")
  expect(await headers(page)).toContain("Total value")
  await expect(groupRow(page, "paid")).toContainText(
    formatCurrency(totalOf("paid"))
  )

  await groupBy(page, "None")
  expect(await headers(page)).toEqual(baseHeaders)
  await expect(table(page).locator("tfoot")).toHaveCount(0)
  await expect(
    node(page).getByText(`1–10 of ${formatNumber(orders.length)} orders`)
  ).toBeVisible()
  expect(errors).toEqual([])
})

test("hides an aggregate column like any other", async ({ page, errors }) => {
  await load(page)
  await groupBy(page, "Status")
  await page.getByRole("button", { name: "Columns" }).click()
  await page.getByRole("menuitemcheckbox", { name: "Total value" }).click()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("menu")).toBeHidden()
  expect(await headers(page)).not.toContain("Total value")
  expect(await headers(page)).toContain("Orders")
  await expect(table(page).locator("tfoot")).not.toContainText(
    formatCurrency(orders.reduce((sum, order) => sum + order.value, 0))
  )
  expect(errors).toEqual([])
})
