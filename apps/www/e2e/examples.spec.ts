import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

test("lists the six example apps", async ({ page }) => {
  await page.goto("/examples/orders")
  const nav = page.getByRole("navigation", { name: "Examples" })

  await expect(nav.getByRole("link")).toHaveText([
    /^Orders/,
    /^Tickets/,
    /^CRM/,
    /^Settings/,
    /^Team workspace/,
    /^Analytics/,
  ])
  await nav.getByRole("link", { name: "Analytics" }).click()
  await expect(page).toHaveURL("/examples/analytics")
  await expect(nav.getByRole("link", { name: "Analytics" })).toHaveAttribute(
    "aria-current",
    "page"
  )
})

test.describe("the team workspace", () => {
  function sidebar(page: Page) {
    return page.getByRole("navigation", { name: "Support desk" })
  }

  async function viewAs(page: Page, persona: string) {
    await page.getByRole("combobox", { name: "View as" }).click()
    await page.getByRole("option", { name: persona, exact: true }).click()
    await expect(page.getByRole("combobox", { name: "View as" })).toBeFocused()
    await expect(
      page.locator('[data-pliant-id="app-sidebar"]')
    ).not.toHaveAttribute("data-pliant-pending")
  }

  test("shows the team default, your change on top, and the admin's lock", async ({
    page,
    errors,
  }) => {
    await page.goto("/examples/team-workspace/inbox")
    await expect(
      page.locator('[data-pliant-id="app-sidebar"]')
    ).not.toHaveAttribute("data-pliant-pending")
    const customers = sidebar(page).getByRole("link", { name: "Customers" })
    const tickets = sidebar(page).getByRole("link", { name: "Tickets" })
    const inbox = sidebar(page).getByRole("link", { name: "Inbox" })
    await expect(customers).toBeVisible()
    expect((await tickets.boundingBox())?.y ?? 0).toBeLessThan(
      (await inbox.boundingBox())?.y ?? 0
    )

    await page.getByRole("button", { name: /^hide customers/ }).click()
    await page.getByRole("button", { name: "Lock in" }).click()
    await expect(customers).toBeHidden()
    await expect(page.getByText("Customized", { exact: true })).toBeVisible()

    await viewAs(page, "Your team")
    await expect(customers).toBeVisible()
    await expect(page.getByText("Customized", { exact: true })).toBeHidden()
    expect((await tickets.boundingBox())?.y ?? 0).toBeLessThan(
      (await inbox.boundingBox())?.y ?? 0
    )

    await viewAs(page, "Admin")
    await expect(
      page.getByRole("region", { name: "Layers" }).getByText("Locked by you")
    ).toBeVisible()

    await viewAs(page, "You")
    await expect(customers).toBeHidden()
    const reset = page.getByRole("button", { name: "Reset the sidebar" })
    await reset.click()
    await expect(customers).toBeVisible()
    await expect(reset).toBeFocused()
    expect((await tickets.boundingBox())?.y ?? 0).toBeLessThan(
      (await inbox.boundingBox())?.y ?? 0
    )
    expect(errors).toEqual([])
  })
})

test("reshapes the CRM pipeline and resets it", async ({ page }) => {
  await page.goto("/examples/crm")
  const ask = page.getByRole("button", { name: /^make the cards compact/ })
  await expect(page.getByText("Kavya Reddy").first()).toBeVisible()

  await ask.click()
  await expect(page.getByText("Kavya Reddy")).toHaveCount(0)
  const reset = page.getByRole("button", { name: "Reset the pipeline" })
  await reset.click()
  await expect(page.getByText("Kavya Reddy").first()).toBeVisible()
  await expect(reset).toBeFocused()
})

test("moves a notification setting on the settings page and resets it", async ({
  page,
}) => {
  await page.goto("/examples/settings")
  const region = page.locator('[data-pliant-id="notification-settings"]')
  await expect(region).not.toHaveAttribute("data-pliant-pending")
  const first = region.getByRole("checkbox").first()
  await expect(first).toHaveAccessibleName(/^Order confirmations/)

  await page.getByRole("button", { name: /^put order alerts first/ }).click()
  await page.getByRole("button", { name: "Lock in" }).click()
  await expect(first).toHaveAccessibleName(/^Order alerts/)
  await expect(page.getByText("Customized", { exact: true })).toBeVisible()

  const reset = page.getByRole("button", { name: "Reset the settings" })
  await reset.click()
  await expect(first).toHaveAccessibleName(/^Order confirmations/)
  await expect(reset).toBeFocused()
})

test("shows the analytics dashboard with its recent orders", async ({
  page,
}) => {
  await page.goto("/examples/analytics")
  await expect(
    page.locator('[data-pliant-id="key-metrics"]')
  ).not.toHaveAttribute("data-pliant-pending")

  await page
    .getByRole("button", { name: "hide the average order value card" })
    .click()
  await expect(
    page.getByRole("group", { name: "Average order value" })
  ).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "Latest orders" })
  ).toBeVisible()
})

for (const path of [
  "/examples/crm",
  "/examples/settings",
  "/examples/analytics",
  "/examples/team-workspace/inbox",
]) {
  test(`${path} fits a phone screen`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(path)
    await expect(
      page.getByRole("button", { name: /^Reset / }).first()
    ).toBeVisible()

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(390)
  })
}
