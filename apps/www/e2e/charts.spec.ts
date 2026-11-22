import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

function example(page: Page, name: string) {
  return page.getByRole("region", { name, exact: true })
}

test("charts a table above it, reshapes the chart, and resets it", async ({
  page,
  errors,
}) => {
  await page.goto("/charts")
  const card = example(page, "Revenue by region")
  const reshape = card.getByRole("group", { name: "Ask about the chart" })
  await expect(card.locator("figure svg")).toHaveCount(0)
  await expect(reshape).toHaveCount(0)

  const ask = card.getByRole("button", {
    name: /^chart revenue by region above this table/,
  })
  await ask.click()
  await expect(ask).toHaveAttribute("aria-pressed", "true")
  const data = card.getByRole("table", { name: "Revenue by region" })
  await expect(data.getByRole("rowheader")).toHaveText([
    "North",
    "South",
    "East",
    "West",
  ])
  const top = async (selector: string) =>
    (await card.locator(selector).first().boundingBox())?.y ?? 0
  expect(await top("figure svg")).toBeLessThan(await top("table:not(.sr-only)"))

  await reshape.getByRole("button", { name: /^show monthly instead/ }).click()
  const monthly = card.getByRole("table", { name: "Revenue by month" })
  await expect(monthly.getByRole("rowheader")).toHaveCount(10)
  await reshape.getByRole("button", { name: /^stack by status/ }).click()
  await expect(monthly.getByRole("columnheader")).toHaveText([
    "Period",
    "Paid",
    "Pending",
    "Overdue",
  ])
  await reshape.getByRole("button", { name: /^make this a line chart/ }).click()
  await expect(card.locator("svg polyline")).toHaveCount(3)

  const reset = card.getByRole("button", { name: "Reset the regions table" })
  await reset.click()
  await expect(card.locator("figure svg")).toHaveCount(0)
  await expect(reshape).toHaveCount(0)
  await expect(reset).toBeFocused()
  expect(errors).toEqual([])
})

test("taking the chart back drops its follow-up asks", async ({ page }) => {
  await page.goto("/charts")
  const card = example(page, "Revenue by region")
  const ask = card.getByRole("button", {
    name: /^chart revenue by region above this table/,
  })

  await ask.click()
  await card.getByRole("button", { name: /^stack by status/ }).click()
  await ask.click()
  await ask.click()
  await expect(
    card.getByRole("button", { name: /^stack by status/ })
  ).toHaveAttribute("aria-pressed", "false")
})

test("adds a chart card to the dashboard", async ({ page }) => {
  await page.goto("/charts")
  const card = example(page, "Sales overview")
  const chart = card.getByRole("region", { name: "Overdue orders by month" })
  await expect(chart).toHaveCount(0)

  await card
    .getByRole("button", { name: /^chart overdue orders by month/ })
    .click()
  await expect(chart.getByRole("table", { includeHidden: true })).toBeAttached()
  await expect(chart.locator("svg rect")).toHaveCount(10)

  await card.getByRole("button", { name: /^make this a line chart/ }).click()
  await expect(chart.locator("svg polyline")).toHaveCount(1)
})

test("charts generated rows from precomputed totals", async ({ page }) => {
  await page.goto("/charts")
  const card = example(page, "Order history")
  await expect(card.getByText("The first 6 of 2,50,000 orders.")).toBeVisible()

  await card
    .getByRole("button", { name: /^chart order value by month/ })
    .click()
  await expect(card.getByText("2,50,000 orders in 10 months.")).toBeVisible()
  await card.getByRole("button", { name: /^show weekly instead/ }).click()
  await expect(card.getByText("2,50,000 orders in 43 weeks.")).toBeVisible()
  await card.getByRole("button", { name: /^split by region/ }).click()
  await expect(
    card
      .getByRole("table", { name: "Order value over time" })
      .getByRole("columnheader")
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
