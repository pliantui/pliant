import type { Page } from "@playwright/test"

import { orders } from "../lib/demo/data"
import { formatCurrency } from "../lib/demo/format"
import { expect, test } from "./fixtures"

const baseHeaders = [
  "Order",
  "Customer",
  "Region",
  "Status",
  "Value",
  "Created",
  "Notes",
]

const percent = new Intl.NumberFormat("en-IN", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

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

async function headers(page: Page) {
  return table(page).getByRole("columnheader").allTextContents()
}

async function column(page: Page, name: string) {
  const index = (await headers(page)).indexOf(name)
  expect(index).toBeGreaterThanOrEqual(0)
  return table(page)
    .locator(`tbody td:nth-child(${String(index + 1)})`)
    .allTextContents()
}

async function toggleColumn(page: Page, name: string) {
  await page.getByRole("button", { name: "Add column" }).click()
  await page.getByRole("menuitemcheckbox", { name }).click()
  await expect(page.getByRole("menu")).toBeHidden()
}

async function groupBy(page: Page, name: string) {
  await page.getByRole("button", { name: "Group by" }).click()
  await page.getByRole("menuitemradio", { name, exact: true }).click()
  await expect(page.getByRole("menu")).toBeHidden()
}

function orderOf(id: string | undefined) {
  const order = orders.find((other) => other.id === id)
  if (!order) throw new Error(`No order ${String(id)}`)
  return order
}

test("adds a column that calculates from each order, and sorts by it", async ({
  page,
  errors,
}) => {
  await load(page)
  await toggleColumn(page, "Value with GST")

  expect(await headers(page)).toEqual([...baseHeaders, "Value with GST"])
  const ids = await column(page, "Order")
  expect(await column(page, "Value with GST")).toEqual(
    ids.map((id) => formatCurrency(orderOf(id).value * 1.18))
  )

  const sort = table(page)
    .getByRole("columnheader", { name: "Value with GST" })
    .getByRole("button")
  await sort.click()
  const lowest = Math.min(...orders.map((order) => order.value))
  expect((await column(page, "Value with GST"))[0]).toBe(
    formatCurrency(lowest * 1.18)
  )
  await sort.click()
  const highest = Math.max(...orders.map((order) => order.value))
  expect((await column(page, "Value with GST"))[0]).toBe(
    formatCurrency(highest * 1.18)
  )
  expect(errors).toEqual([])
})

test("keeps the column after a reload and removes it from the menu", async ({
  page,
  errors,
}) => {
  await load(page)
  await toggleColumn(page, "Value with GST")
  await page.reload()
  await expect(node(page)).not.toHaveAttribute("data-pliant-pending")
  expect(await headers(page)).toContain("Value with GST")
  await page.getByRole("button", { name: "Add column" }).click()
  await expect(
    page.getByRole("menuitemcheckbox", { name: "Value with GST" })
  ).toBeChecked()
  await page.keyboard.press("Escape")

  await toggleColumn(page, "Value with GST")
  expect(await headers(page)).toEqual(baseHeaders)
  expect(errors).toEqual([])
})

test("shows each order's share of the value among the orders in its group", async ({
  page,
  errors,
}) => {
  await load(page)
  await toggleColumn(page, "Share of value")
  const ids = await column(page, "Order")
  const everything = orders.reduce((sum, order) => sum + order.value, 0)
  expect(await column(page, "Share of value")).toEqual(
    ids.map((id) => percent.format(orderOf(id).value / everything))
  )

  await groupBy(page, "Status")
  await table(page).getByRole("button", { name: /paid/i }).click()
  const paid = orders.filter((order) => order.status === "paid")
  const paidTotal = paid.reduce((sum, order) => sum + order.value, 0)
  const paidIds = (await column(page, "Order")).filter((id) => id !== "")
  expect(paidIds.length).toBeGreaterThan(0)
  expect(
    (await column(page, "Share of value")).filter((text) => text !== "")
  ).toEqual(paidIds.map((id) => percent.format(orderOf(id).value / paidTotal)))
  expect(errors).toEqual([])
})
