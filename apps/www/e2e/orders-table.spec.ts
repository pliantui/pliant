import type { Page } from "@playwright/test"

import { orders } from "../app/(examples)/examples/orders/data"
import { formatNumber } from "../app/(examples)/examples/orders/format"
import { expect, test } from "./fixtures"

const surface = "/examples/orders"
const total = formatNumber(orders.length)
const overdue = orders.filter((order) => order.status === "overdue")
const highest = Math.max(...orders.map((order) => order.value))
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

function header(page: Page, name: string) {
  return table(page).getByRole("columnheader", { name, exact: true })
}

function panel(page: Page) {
  return page.getByRole("complementary", { name: "Ask" })
}

async function load(page: Page) {
  await page.goto(surface)
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

function isDescending(values: readonly number[]) {
  return values.every((value, index) => value <= (values[index - 1] ?? value))
}

async function pointAtTable(page: Page) {
  await page.keyboard.down("Alt")
  const box = page
    .locator('[data-slot="pliant-point-mode"]')
    .getByRole("button", { name: "All orders" })
  await expect(box).toBeVisible()
  expect(await box.boundingBox()).toEqual(await node(page).boundingBox())
  await box.click()
  await page.keyboard.up("Alt")
  await expect(
    panel(page).getByRole("combobox", { name: "Change" })
  ).toHaveText("All orders")
}

async function ask(page: Page, suggestion: string) {
  await pointAtTable(page)
  await panel(page)
    .getByRole("group", { name: "Suggestions" })
    .getByRole("button", { name: suggestion, exact: true })
    .click()
  await expect(panel(page).getByRole("textbox", { name: "Ask" })).toBeFocused()
  await page.keyboard.press("Enter")
}

interface Ask {
  suggestion: string
  explain: readonly string[]
  shows: (page: Page) => Promise<void>
}

const asks: readonly Ask[] = [
  {
    suggestion: "sort by value, highest first",
    explain: ["Sorted by value, highest first."],
    shows: async (page) => {
      await expect(header(page, "Value")).toHaveAttribute(
        "aria-sort",
        "descending"
      )
      const values = (await column(page, "Value")).map((cell) =>
        Number(cell.replace(/\D/g, ""))
      )
      expect(values[0]).toBe(highest)
      expect(isDescending(values)).toBe(true)
    },
  },
  {
    suggestion: "hide the notes column",
    explain: ["Hid the Notes column from the orders table."],
    shows: async (page) => {
      expect(await headers(page)).toEqual(
        baseHeaders.filter((name) => name !== "Notes")
      )
    },
  },
  {
    suggestion: "only show overdue orders",
    explain: ["Filtered table to show only overdue orders."],
    shows: async (page) => {
      await expect(
        node(page).getByText(`1–10 of ${formatNumber(overdue.length)} orders`)
      ).toBeVisible()
      expect(new Set(await column(page, "Status"))).toEqual(
        new Set(["overdue"])
      )
    },
  },
  {
    suggestion: "put customer before order",
    explain: ["Moved Customer column before Order."],
    shows: async (page) => {
      expect(await headers(page)).toEqual([
        "Customer",
        "Order",
        ...baseHeaders.slice(2),
      ])
    },
  },
  {
    suggestion: "pin the order column",
    explain: ["Pinned the Order column to the start of the table."],
    shows: async (page) => {
      await expect(header(page, "Order")).toHaveAttribute(
        "data-pinned",
        "start"
      )
      const scroller = table(page).locator("..")
      await scroller.evaluate((element) => {
        element.scrollLeft = element.scrollWidth
      })
      expect(
        await scroller.evaluate((element) => element.scrollLeft)
      ).toBeGreaterThan(0)
      const pinned = await header(page, "Order").boundingBox()
      const view = await scroller.boundingBox()
      expect(pinned?.x).toBe(view?.x)
      await scroller.evaluate((element) => {
        element.scrollLeft = 0
      })
    },
  },
  {
    suggestion: "make the customer column 240 pixels wide",
    explain: ["Set the Customer column width to 240 pixels."],
    shows: async (page) => {
      expect((await header(page, "Customer").boundingBox())?.width).toBe(240)
    },
  },
  {
    suggestion: "newest first and hide region",
    explain: [
      "Sorted by created date, newest first.",
      "Hid the Region column.",
    ],
    shows: async (page) => {
      await expect(header(page, "Created")).toHaveAttribute(
        "aria-sort",
        "descending"
      )
      expect(await headers(page)).not.toContain("Region")
      const dates = (await column(page, "Created")).map((cell) =>
        Date.parse(cell)
      )
      expect(isDescending(dates)).toBe(true)
    },
  },
]

async function showsBase(page: Page) {
  expect(await headers(page)).toEqual(baseHeaders)
  await expect(table(page).locator("[aria-sort]")).toHaveCount(0)
  await expect(table(page).locator("[data-pinned]")).toHaveCount(0)
  await expect(node(page).getByText(`1–10 of ${total} orders`)).toBeVisible()
}

test.describe("asking about the table", () => {
  // Narrow enough that the table scrolls sideways, panel open or not, so a
  // pinned column has somewhere to stay.
  test.use({ viewport: { width: 1024, height: 900 } })

  for (const { suggestion, explain, shows } of asks) {
    test(`previews and locks in "${suggestion}"`, async ({ page, errors }) => {
      await load(page)
      await ask(page, suggestion)

      const status = panel(page).getByRole("status")
      for (const sentence of explain) {
        await expect(status).toContainText(sentence)
      }
      await shows(page)

      await panel(page).getByRole("button", { name: "Lock in" }).click()
      await expect(status).toContainText("Locked in.")
      await shows(page)

      await page.reload()
      await expect(node(page)).not.toHaveAttribute("data-pliant-pending")
      await expect(panel(page)).toBeHidden()
      await shows(page)
      expect(errors).toEqual([])
    })
  }

  test("asks what nicer means", async ({ page, errors }) => {
    await load(page)
    await ask(page, "make it nicer")

    await expect(panel(page).getByRole("status")).toHaveText(
      "What would make the orders table nicer for you: easier scanning, a cleaner layout, or something specific like sorting or hiding columns?"
    )
    await expect(
      panel(page).getByRole("button", { name: "Lock in" })
    ).toBeHidden()
    await showsBase(page)
    expect(errors).toEqual([])
  })

  test("drops the preview on Discard", async ({ page, errors }) => {
    await load(page)
    await ask(page, "sort by value, highest first")
    await expect(header(page, "Value")).toHaveAttribute(
      "aria-sort",
      "descending"
    )

    await panel(page).getByRole("button", { name: "Discard" }).click()
    await expect(panel(page).getByRole("status")).toHaveText("Discarded.")
    await showsBase(page)

    await page.reload()
    await expect(node(page)).not.toHaveAttribute("data-pliant-pending")
    await showsBase(page)
    expect(errors).toEqual([])
  })
})

test("keeps a sort and hidden column for good", async ({
  page,
  context,
  errors,
}) => {
  await load(page)
  await header(page, "Value").getByRole("button").click()
  await expect(header(page, "Value")).toHaveAttribute("aria-sort", "ascending")
  await page.getByRole("button", { name: "Columns" }).click()
  await page.getByRole("menuitemcheckbox", { name: "Notes" }).click()
  await page.keyboard.press("Escape")
  await expect(header(page, "Notes")).toHaveCount(0)

  await page.reload()
  await expect(node(page)).not.toHaveAttribute("data-pliant-pending")
  await expect(header(page, "Value")).toHaveAttribute("aria-sort", "ascending")
  await expect(header(page, "Notes")).toHaveCount(0)

  const tab = await context.newPage()
  await load(tab)
  await expect(header(tab, "Value")).toHaveAttribute("aria-sort", "ascending")
  await expect(header(tab, "Notes")).toHaveCount(0)
  expect(errors).toEqual([])
})

test("keeps the page for the session only", async ({
  page,
  context,
  errors,
}) => {
  await load(page)
  await node(page).getByRole("button", { name: "Next" }).click()
  await expect(node(page).getByText(`11–20 of ${total} orders`)).toBeVisible()

  await page.reload()
  await expect(node(page)).not.toHaveAttribute("data-pliant-pending")
  await expect(node(page).getByText(`11–20 of ${total} orders`)).toBeVisible()

  // A new tab starts a new session: it shares localStorage, not
  // sessionStorage.
  const tab = await context.newPage()
  await load(tab)
  await expect(node(tab).getByText(`1–10 of ${total} orders`)).toBeVisible()
  expect(errors).toEqual([])
})
