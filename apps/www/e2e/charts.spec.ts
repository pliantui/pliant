import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

function example(page: Page, name: string) {
  return page.getByRole("region", { name, exact: true })
}

test("charts revenue by region above the table, and resets it", async ({
  page,
  errors,
}) => {
  await page.goto("/charts")
  const card = example(page, "Revenue by region")
  const chart = card.getByRole("table", { name: "Revenue by region" })
  await expect(chart).toHaveCount(0)

  const ask = card.getByRole("button", {
    name: /^chart revenue by region above this table/,
  })
  await ask.click()
  await expect(ask).toHaveAttribute("aria-pressed", "true")
  await expect(chart).toBeAttached()
  await expect(card.getByText("Customized", { exact: true })).toBeVisible()
  const top = async (selector: string) =>
    (await card.locator(selector).first().boundingBox())?.y ?? 0
  expect(await top("svg")).toBeLessThan(await top("table:not(.sr-only)"))

  const reset = card.getByRole("button", { name: "Reset the regions table" })
  await reset.click()
  await expect(chart).toHaveCount(0)
  await expect(reset).toBeFocused()
  expect(errors).toEqual([])
})

test("adds an average order value card to the dashboard", async ({ page }) => {
  await page.goto("/charts")
  const card = example(page, "Sales overview")
  await expect(
    card.getByRole("group", { name: "Average order value" })
  ).toHaveCount(0)

  await card
    .getByRole("button", { name: /^add a card with average order value/ })
    .click()
  await expect(
    card.getByRole("group", { name: "Average order value" })
  ).toContainText("₹")
})

test("reshapes a chart with asks that combine", async ({ page }) => {
  await page.goto("/charts")
  const card = example(page, "Order value")
  const data = card.getByRole("table", { name: "Order value" })
  await expect(data.getByRole("rowheader")).toHaveText(["Q1", "Q2", "Q3", "Q4"])

  await card.getByRole("button", { name: /^show monthly instead/ }).click()
  await expect(data.getByRole("rowheader")).toHaveCount(10)
  await card.getByRole("button", { name: /^stack by status/ }).click()
  await expect(data.getByRole("columnheader")).toHaveText([
    "Period",
    "Paid",
    "Pending",
    "Overdue",
  ])
  await expect(
    card.getByText("By month, Jan–Oct 2026, split by status.")
  ).toBeVisible()

  await card.getByRole("button", { name: /^make this a line chart/ }).click()
  await expect(card.locator("svg polyline")).toHaveCount(3)
  await expect(card.locator("svg rect")).toHaveCount(0)

  await card.getByRole("button", { name: /^show monthly instead/ }).click()
  await expect(data.getByRole("rowheader")).toHaveText(["Q1", "Q2", "Q3", "Q4"])
})

test("charts a large dataset from the server's totals", async ({ page }) => {
  await page.goto("/charts")
  const card = example(page, "Order history")
  await expect(
    card.getByText(/orders, summed on the server into 10 points/)
  ).toBeVisible()

  await card.getByRole("button", { name: /^show weekly instead/ }).click()
  await expect(card.getByText(/into 43 points/)).toBeVisible()
  await card.getByRole("button", { name: /^split by region/ }).click()
  await expect(
    card.getByRole("table", { name: "Order history" }).getByRole("columnheader")
  ).toHaveText(["Period", "North", "South", "East", "West"])
})

test("fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/charts")
  await expect(example(page, "Order history")).toBeVisible()

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390)
})
