import type { Page } from "@playwright/test"

import { orders } from "../lib/demo/data"
import { formatCurrency, formatNumber } from "../lib/demo/format"
import { orderRegions, orderStatuses, type Order } from "../lib/demo/schema"
import { expect, pickCustomize, test } from "./fixtures"

const surface = "/examples/orders"

async function seed(page: Page, ops: unknown[]) {
  await page.addInitScript(
    ({ key, record }) => {
      localStorage.setItem(key, JSON.stringify(record))
    },
    {
      key: `pliant:${surface}:01KAB0000000000000000000T1`,
      record: {
        overlay: {
          v: 1,
          id: "01KAB0000000000000000000T1",
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
      },
    }
  )
}

function node(page: Page) {
  return page.locator('[data-pliant-id="orders-table"]')
}

function toolbar(page: Page) {
  return page.locator('[data-slot="pliant-data-table-toolbar"]')
}

// The table's own Customize menu, in its toolbar.
function tableMenu(page: Page) {
  return toolbar(page).getByRole("button", { name: "Customize", exact: true })
}

// The mark the toolbar's menu shows while the user has changed the table.
function customized(page: Page) {
  return toolbar(page).getByText("Customized", { exact: true })
}

function table(page: Page) {
  return page.getByRole("table", { name: "All orders" })
}

function header(page: Page, name: string) {
  return table(page).getByRole("columnheader", { name, exact: true })
}

async function load(page: Page, ops: unknown[] = []) {
  if (ops.length) {
    await seed(page, ops)
  }
  await page.goto(surface)
  await expect(node(page)).not.toHaveAttribute("data-pliant-pending")
}

async function column(page: Page, name: string) {
  const headers = await table(page).getByRole("columnheader").allTextContents()
  const index = headers.indexOf(name)
  expect(index).toBeGreaterThanOrEqual(0)
  return table(page)
    .locator(`tbody td:nth-child(${String(index + 1)})`)
    .allTextContents()
}

function range(page: Page, count: number, shown = Math.min(count, 10)) {
  return page.getByText(
    `1–${formatNumber(shown)} of ${formatNumber(count)} orders`
  )
}

function capitalized(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function countOf(rows: readonly Order[], key: "status" | "region") {
  const counts = new Map<string, number>()
  for (const row of rows) {
    counts.set(row[key], (counts.get(row[key]) ?? 0) + 1)
  }
  return counts
}

async function pick(page: Page, menu: string, item: string | RegExp) {
  await page
    .getByRole("button", { name: menu, exact: true, expanded: false })
    .click()
  await page.getByRole("menuitemradio", { name: item }).click()
  await expect(page.getByRole("menu")).toBeHidden()
}

test("narrows the rows to the customers the search matches", async ({
  page,
  errors,
}) => {
  await load(page)
  await page.getByRole("searchbox", { name: "Customer" }).fill("bharat")

  const matches = orders.filter((order) =>
    order.customer.toLowerCase().includes("bharat")
  )
  expect(matches.length).toBeGreaterThan(0)
  await expect(range(page, matches.length)).toBeVisible()
  const customers = await column(page, "Customer")
  expect(customers.length).toBeGreaterThan(0)
  expect(customers.every((name) => /bharat/i.test(name))).toBe(true)
  expect(errors).toEqual([])
})

test("counts the rows for each value and filters by the picked ones", async ({
  page,
  errors,
}) => {
  await load(page)
  await page
    .getByRole("button", { name: "Status", exact: true, expanded: false })
    .click()
  for (const [status, count] of countOf(orders, "status")) {
    await expect(
      page.getByRole("menuitemcheckbox", {
        name: new RegExp(`^${capitalized(status)}`),
      })
    ).toHaveText(`${capitalized(status)}${formatNumber(count)}`)
  }
  expect(orderStatuses.length).toBe(countOf(orders, "status").size)
  await page.getByRole("menuitemcheckbox", { name: /^Overdue/ }).click()
  await page.getByRole("menuitemcheckbox", { name: /^Refunded/ }).click()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("menu")).toBeHidden()

  const picked = orders.filter(
    (order) => order.status === "overdue" || order.status === "refunded"
  )
  await expect(range(page, picked.length)).toBeVisible()
  const statuses = await column(page, "Status")
  expect(statuses.every((status) => /overdue|refunded/i.test(status))).toBe(
    true
  )
  await expect(
    page.getByRole("button", { name: /^Status/, expanded: false })
  ).toContainText("Overdue")

  // The other filters' counts are over the rows this one leaves.
  await page
    .getByRole("button", { name: "Region", exact: true, expanded: false })
    .click()
  for (const region of orderRegions) {
    const count = countOf(picked, "region").get(region)
    if (count !== undefined) {
      await expect(
        page.getByRole("menuitemcheckbox", { name: new RegExp(`^${region}`) })
      ).toHaveText(`${region}${formatNumber(count)}`)
    }
  }
  await page.keyboard.press("Escape")
  await expect(page.getByRole("menu")).toBeHidden()

  await page.getByRole("button", { name: /^Status/, expanded: false }).click()
  await page.getByRole("menuitem", { name: "Clear filter" }).click()
  await expect(range(page, orders.length)).toBeVisible()
  expect(errors).toEqual([])
})

test("sorts by a sort option, and offers the ones ops add", async ({
  page,
  errors,
}) => {
  await load(page, [
    {
      op: "addSortOption",
      target: "orders-table",
      id: "smallest",
      label: "Smallest first",
      sort: [{ field: "value", dir: "asc" }],
    },
  ])

  await pick(page, "Sort", "Largest first")
  await expect(header(page, "Value")).toHaveAttribute("aria-sort", "descending")
  const highest = Math.max(...orders.map((order) => order.value))
  expect((await column(page, "Value"))[0]).toBe(formatCurrency(highest))

  await pick(page, "Sort", "Smallest first")
  await expect(header(page, "Value")).toHaveAttribute("aria-sort", "ascending")
  const lowest = Math.min(...orders.map((order) => order.value))
  expect((await column(page, "Value"))[0]).toBe(formatCurrency(lowest))

  await page
    .getByRole("button", { name: "Sort", exact: true, expanded: false })
    .click()
  await expect(
    page.getByRole("menuitemradio", { name: "Smallest first" })
  ).toBeChecked()
  expect(errors).toEqual([])
})

test("applies a preset's filters and sort", async ({ page, errors }) => {
  await load(page, [
    {
      op: "addPreset",
      target: "orders-table",
      id: "north-paid",
      label: "Paid in the north",
      filters: [
        { field: "status", operator: "eq", value: "paid" },
        { field: "region", operator: "eq", value: "North" },
      ],
    },
  ])

  await pick(page, "Presets", "To chase")
  const toChase = orders.filter(
    (order) => order.status === "overdue" || order.status === "pending"
  )
  await expect(range(page, toChase.length)).toBeVisible()
  await expect(header(page, "Value")).toHaveAttribute("aria-sort", "descending")
  const statuses = await column(page, "Status")
  expect(statuses.every((status) => /overdue|pending/i.test(status))).toBe(true)

  await pick(page, "Presets", "Paid in the north")
  const northPaid = orders.filter(
    (order) => order.status === "paid" && order.region === "North"
  )
  await expect(range(page, northPaid.length)).toBeVisible()
  expect(
    (await column(page, "Region")).every((region) => region === "North")
  ).toBe(true)
  expect(errors).toEqual([])
})

test("shows the filters ops add", async ({ page, errors }) => {
  await load(page, [
    {
      op: "addFilterControl",
      target: "orders-table",
      id: "notes-search",
      field: "notes",
      control: "search",
      label: "Notes",
    },
  ])

  const note = orders.find((order) => order.notes)?.notes ?? ""
  expect(note).not.toBe("")
  await page.getByRole("searchbox", { name: "Notes" }).fill(note)
  const matches = orders.filter((order) =>
    order.notes.toLowerCase().includes(note.toLowerCase())
  )
  await expect(range(page, matches.length)).toBeVisible()
  expect(errors).toEqual([])
})

test("shows a chosen number of rows per page", async ({ page, errors }) => {
  await load(page)
  await page.getByRole("button", { name: "Next" }).click()
  await expect(
    page.getByText(new RegExp(`^11–20 of ${formatNumber(orders.length)} `))
  ).toBeVisible()
  // Moving between pages isn't a change to reset.
  await expect(customized(page)).toBeHidden()

  await page.getByRole("combobox", { name: "Rows per page" }).click()
  await page.getByRole("option", { name: "20" }).click()
  await expect(range(page, orders.length, 20)).toBeVisible()
  await expect(table(page).locator("tbody tr")).toHaveCount(20)
  await expect(customized(page)).toBeVisible()

  await pickCustomize(tableMenu(page), "Reset to default")
  await expect(range(page, orders.length)).toBeVisible()
  await expect(customized(page)).toBeHidden()
  expect(errors).toEqual([])
})

test("resets the user's changes to the table, and keeps them reset", async ({
  page,
  errors,
}) => {
  await load(page)
  await expect(customized(page)).toBeHidden()

  await pick(page, "Sort", "Largest first")
  await page.getByRole("button", { name: "Columns" }).click()
  await page.getByRole("menuitemcheckbox", { name: "Notes" }).click()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("menu")).toBeHidden()
  await page.getByRole("button", { name: "Highlight" }).click()
  await page.getByRole("menuitemcheckbox", { name: "Overdue" }).click()
  await page.getByRole("searchbox", { name: "Customer" }).fill("bharat")
  await expect(header(page, "Notes")).toBeHidden()
  await expect(customized(page)).toBeVisible()

  await pickCustomize(tableMenu(page), "Reset to default")

  await expect(customized(page)).toBeHidden()
  await expect(tableMenu(page)).toBeFocused()
  await expect(range(page, orders.length)).toBeVisible()
  await expect(header(page, "Notes")).toBeVisible()
  await expect(header(page, "Value")).not.toHaveAttribute("aria-sort")
  await expect(page.getByRole("searchbox", { name: "Customer" })).toHaveValue(
    ""
  )
  await expect(table(page).getByText(/^Highlighted:/)).toHaveCount(0)

  await page.reload()
  await expect(node(page)).not.toHaveAttribute("data-pliant-pending")
  await expect(header(page, "Notes")).toBeVisible()
  await expect(header(page, "Value")).not.toHaveAttribute("aria-sort")
  await expect(table(page).getByText(/^Highlighted:/)).toHaveCount(0)
  await expect(customized(page)).toBeHidden()
  expect(errors).toEqual([])
})
