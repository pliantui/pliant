import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

function card(page: Page, name: string) {
  return page.getByRole("region", { name })
}

function chip(page: Page, cardName: string, ask: string | RegExp) {
  return card(page, cardName)
    .getByRole("group", { name: `Ask about ${cardName.toLowerCase()}` })
    .getByRole("button", { name: ask })
}

async function statOrder(page: Page) {
  return card(page, "Key metrics")
    .locator('[data-pliant-id="key-metrics"]')
    .getByRole("group")
    .evaluateAll((groups) =>
      groups.map((group) => group.getAttribute("aria-label"))
    )
}

async function load(page: Page) {
  await page.goto("/")
  await expect(
    card(page, "Key metrics").locator('[data-pliant-id="key-metrics"]')
  ).not.toHaveAttribute("data-pliant-pending")
}

test("leads to the docs, the components and the changelog", async ({
  page,
}) => {
  await page.goto("/")
  const main = page.getByRole("main")

  await expect(
    main.getByRole("heading", { level: 1, name: /pliant interfaces/ })
  ).toBeVisible()
  await expect(main.getByRole("link", { name: "Get started" })).toHaveAttribute(
    "href",
    "/docs"
  )
  await expect(
    main.getByRole("link", { name: "View components" })
  ).toHaveAttribute("href", "/components")
  await expect(
    main.getByRole("link", { name: /Point at any part of a page and ask/ })
  ).toHaveAttribute("href", "/changelog")
})

test("says the demo replays recorded answers", async ({ page }) => {
  await page.goto("/")

  await expect(
    page.getByText("This demo replays recorded answers; no AI model is called.")
  ).toBeVisible()
})

test("reshapes the key metrics with a recorded ask, and resets them", async ({
  page,
  errors,
}) => {
  await load(page)
  const metrics = card(page, "Key metrics")
  const before = await statOrder(page)

  await chip(page, "Key metrics", "put the overdue card first").click()
  await expect(metrics.getByRole("status")).toHaveText(
    "Moved the Overdue card to the first position."
  )
  expect(await statOrder(page)).toEqual([
    "Overdue",
    ...before.filter((name) => name !== "Overdue"),
  ])
  await expect(metrics.getByText("Customized")).toBeHidden()

  await metrics.getByRole("button", { name: "Lock in" }).click()
  await expect(metrics.getByText("Customized")).toBeVisible()

  await metrics.getByRole("button", { name: "Reset key metrics" }).click()
  await expect(metrics.getByText("Customized")).toBeHidden()
  await expect.poll(() => statOrder(page)).toEqual(before)
  expect(errors).toEqual([])
})

test("labels scripted asks and discards their preview", async ({
  page,
  errors,
}) => {
  await load(page)
  const settings = card(page, "Notifications")
  const ask = chip(page, "Notifications", /hide product news/)

  await expect(ask).toContainText("Scripted")
  await ask.click()
  await expect(settings.getByLabel("Product news")).toBeHidden()

  await settings.getByRole("button", { name: "Discard" }).click()
  await expect(settings.getByLabel("Product news")).toBeVisible()
  expect(errors).toEqual([])
})

test("filters the recent orders with a recorded ask, and resets them", async ({
  page,
  errors,
}) => {
  await load(page)
  const orders = card(page, "Recent orders")
  const rows = orders
    .getByRole("table")
    .getByRole("row")
    .filter({ has: page.getByRole("cell") })
  const before = await rows.allTextContents()

  await chip(page, "Recent orders", "only show overdue orders").click()
  await expect(rows.first()).toContainText(/overdue/i)
  for (const row of await rows.all()) {
    await expect(row).toContainText(/overdue/i)
  }

  await orders.getByRole("button", { name: "Lock in" }).click()
  await expect(orders.getByText("Customized")).toBeVisible()

  await orders.getByRole("button", { name: "Reset recent orders" }).click()
  await expect(orders.getByText("Customized")).toBeHidden()
  await expect.poll(() => rows.allTextContents()).toEqual(before)
  expect(errors).toEqual([])
})

test("plays the scripted chart asks under a banner, and resets", async ({
  page,
  errors,
}) => {
  await load(page)
  const revenue = card(page, "Revenue")

  await expect(
    revenue.getByRole("note").filter({ hasText: "Not fully implemented yet" })
  ).toBeVisible()
  await chip(page, "Revenue", /stack by status/).click()
  await expect(revenue.getByRole("list")).toHaveText(/Paid.*Pending.*Overdue/)
  await expect(revenue.getByText("Customized")).toBeVisible()

  await revenue.getByRole("button", { name: "Reset revenue" }).click()
  await expect(revenue.getByRole("list")).toBeHidden()
  expect(errors).toEqual([])
})

test("answers the ask panel from the recordings", async ({ page, errors }) => {
  await load(page)

  await page.getByRole("button", { name: "Ask" }).click()
  const panel = page.getByRole("complementary", { name: "Ask" })
  await panel
    .getByRole("group", { name: "Suggestions" })
    .getByRole("button", { name: "hide the average order value card" })
    .click()
  await page.keyboard.press("Enter")

  await expect(panel.getByRole("status")).toContainText(
    "Hid the Average order value card"
  )
  expect(errors).toEqual([])
})

test("switches the install command between package managers", async ({
  page,
}) => {
  await page.goto("/")
  const install = page.getByRole("region", { name: "Add it to your app" })

  await install.getByRole("tab", { name: "npm", exact: true }).click()

  await expect(install.getByRole("tabpanel")).toContainText(
    "npx shadcn@latest add"
  )
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("fits the screen", async ({ page }) => {
    await load(page)

    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
      )
    ).toBe(false)
  })
})
