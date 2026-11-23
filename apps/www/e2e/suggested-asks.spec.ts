import type { Page } from "@playwright/test"

import { orders } from "../lib/demo/data"
import { formatCurrency } from "../lib/demo/format"
import { expect, test } from "./fixtures"

function preview(page: Page) {
  return page.getByRole("tabpanel", { name: "Preview" })
}

async function ask(page: Page, prompt: RegExp) {
  await preview(page).getByRole("button", { name: prompt }).click()
  await preview(page).getByRole("button", { name: "Lock in" }).click()
}

async function loadTable(page: Page) {
  await page.goto("/docs/components/data-table")
  await expect(
    preview(page).locator('[data-pliant-id="orders-table"]')
  ).not.toHaveAttribute("data-pliant-pending")
  return preview(page).getByRole("table")
}

// The orders the data table preview shows.
const shown = orders.slice(0, 48)

test("groups the orders by region with the average and standard deviation", async ({
  page,
  errors,
}) => {
  const table = await loadTable(page)
  await ask(page, /^group by region with average order value and std dev/)

  const north = shown
    .filter((order) => order.region === "North")
    .map((order) => order.value)
  const mean = north.reduce((sum, value) => sum + value, 0) / north.length
  const stddev = Math.sqrt(
    north.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      (north.length - 1)
  )
  const group = table
    .getByRole("row")
    .filter({ has: page.getByRole("button", { name: /North/ }) })
  await expect(group).toContainText(formatCurrency(mean))
  await expect(group).toContainText(formatCurrency(stddev))
  expect(errors).toEqual([])
})

test("adds the share, running total and days since order columns", async ({
  page,
  errors,
}) => {
  const table = await loadTable(page)
  await ask(page, /^show each order's share of total value/)
  await ask(page, /^add a running total of order value/)
  await ask(page, /^add a column for days since each order was placed/)

  for (const name of [
    /^Share of value/,
    /^Running total/,
    /^Days since order/,
  ]) {
    await expect(table.getByRole("columnheader", { name })).toBeVisible()
  }
  const total = shown.reduce((sum, order) => sum + order.value, 0)
  const [first, second] = shown
  const firstRow = table.getByRole("row").filter({ hasText: first?.id ?? "" })
  const secondRow = table.getByRole("row").filter({ hasText: second?.id ?? "" })
  await expect(firstRow).toContainText(
    `${(((first?.value ?? 0) / total) * 100).toFixed(1)}%`
  )
  await expect(secondRow).toContainText(
    formatCurrency((first?.value ?? 0) + (second?.value ?? 0))
  )
  expect(errors).toEqual([])
})

test("sets a start page and folds sidebar links under More", async ({
  page,
  errors,
}) => {
  await page.goto("/docs/components/nav")
  const nav = preview(page).locator('[data-pliant-id="workspace-nav"]')
  await expect(nav).not.toHaveAttribute("data-pliant-pending")
  const reports = nav.getByRole("link", { name: "Reports" })
  await expect(reports).toBeVisible()

  await ask(page, /^move Reports and Settings under More/)
  await expect(reports).toBeHidden()
  await nav.getByRole("button", { name: "More" }).click()
  await expect(reports).toBeVisible()

  await ask(page, /^open Tickets when I log in/)
  await nav.getByRole("button", { name: "Tickets options" }).click()
  await expect(
    page.getByRole("menuitemcheckbox", { name: "Start page" })
  ).toBeChecked()
  expect(errors).toEqual([])
})

test("defaults the ticket priority and folds rarely used fields", async ({
  page,
  errors,
}) => {
  await page.goto("/docs/components/form")
  const form = preview(page).locator('[data-pliant-id="ticket-form"]')
  await expect(form).not.toHaveAttribute("data-pliant-pending")

  await ask(page, /^default priority to High for me/)
  await expect(
    preview(page).getByRole("combobox", { name: "Priority" })
  ).toHaveText(/High/)

  const cc = preview(page).getByRole("textbox", { name: "CC" })
  await expect(cc).toBeVisible()
  await ask(page, /^fold the order number and CC into More fields/)
  await expect(cc).toBeHidden()
  await preview(page)
    .getByRole("button", { name: "More fields", exact: true })
    .click()
  await expect(cc).toBeVisible()
  expect(errors).toEqual([])
})

test("leads the key metrics preview with an ask that isn't a layout change", async ({
  page,
}) => {
  await page.goto("/docs/components/region")
  const asks = preview(page).getByRole("group", { name: /^Ask about / })

  await expect(asks.first().getByRole("button").first()).toHaveAccessibleName(
    /^add a card for this quarter's refund rate/
  )
  await expect(
    preview(page).getByText(
      "This demo replays recorded answers, and hand-written answers for the asks marked scripted; no AI model is called."
    )
  ).toBeVisible()
})

for (const [name, ask] of [
  [/^A dashboard with key metrics/, /^make the chart a line chart/],
  [/^A sales pipeline board/, /^show the total for each stage/],
  [/^A team page/, /^publish this layout for my team/],
] as const) {
  test(`leads the ${name.source.slice(1)} block with an ask that isn't a layout change`, async ({
    page,
  }) => {
    await page.goto("/blocks")
    const asks = page
      .getByRole("region", { name })
      .getByRole("group", { name: /^Ask about / })

    await expect(asks.first().getByRole("button").first()).toHaveAccessibleName(
      ask
    )
  })
}

test("labels a scripted answer as scripted where it plays", async ({
  page,
}) => {
  await page.goto("/docs/components/data-table")
  await preview(page)
    .getByRole("button", { name: /^highlight overdue orders over ₹1L/ })
    .click()

  await expect(
    preview(page).getByRole("status").filter({ hasText: "Highlighted the" })
  ).toContainText("Scripted answer")
})
