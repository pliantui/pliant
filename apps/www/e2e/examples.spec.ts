import type { Page } from "@playwright/test"

import { deals } from "../lib/demo/data"
import { expect, pickCustomize, test } from "./fixtures"

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

    const reports = sidebar(page).getByRole("link", { name: "Reports" })
    await page
      .getByRole("button", { name: /^move Reports and Settings under More/ })
      .click()
    await page.getByRole("button", { name: "Lock in" }).click()
    await expect(reports).toBeHidden()
    await expect(page.getByText("Customized", { exact: true })).toBeVisible()

    await viewAs(page, "Your team")
    await expect(reports).toBeVisible()
    await expect(page.getByText("Customized", { exact: true })).toBeHidden()
    expect((await tickets.boundingBox())?.y ?? 0).toBeLessThan(
      (await inbox.boundingBox())?.y ?? 0
    )

    await viewAs(page, "Admin")
    await expect(
      page.getByRole("region", { name: "Layers" }).getByText("Locked by you")
    ).toBeVisible()

    await viewAs(page, "You")
    await expect(reports).toBeHidden()
    const menu = page.getByRole("button", { name: "Customize the sidebar" })
    await pickCustomize(menu, "Reset to default")
    await expect(reports).toBeVisible()
    await expect(menu).toBeFocused()
    expect((await tickets.boundingBox())?.y ?? 0).toBeLessThan(
      (await inbox.boundingBox())?.y ?? 0
    )
    expect(errors).toEqual([])
  })
})

test("flags the deals with no activity in 14 days and resets it", async ({
  page,
}) => {
  await page.goto("/examples/crm")
  const ask = page.getByRole("button", {
    name: /^flag deals with no activity in 14 days/,
  })
  // The demo's 14 days count back from its latest activity.
  const latest = deals
    .map((deal) => deal.lastActivityAt)
    .reduce((last, day) => (day > last ? day : last))
  const cutoff = new Date(Date.parse(latest) - 13 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  const stale = deals.filter((deal) => deal.lastActivityAt < cutoff)
  expect(stale.length).toBeGreaterThan(0)
  expect(stale.length).toBeLessThan(deals.length)
  const flagged = page.getByRole("listitem").filter({
    hasText: /No activity since /,
  })

  await ask.click()
  await expect(flagged).toHaveCount(stale.length)
  for (const deal of stale) {
    await expect(flagged.filter({ hasText: deal.customer })).toHaveCount(1)
  }
  const menu = page.getByRole("button", {
    name: "Customize the pipeline",
    exact: true,
  })
  await pickCustomize(menu, "Reset to default")
  await expect(flagged).toHaveCount(0)
  await expect(menu).toBeFocused()
})

test("folds notification settings under More on the settings page and resets it", async ({
  page,
}) => {
  await page.goto("/examples/settings")
  const region = page.locator('[data-pliant-id="notification-settings"]')
  await expect(region).not.toHaveAttribute("data-pliant-pending")
  const news = region.getByRole("checkbox", { name: /^Product news/ })
  await expect(news).toBeVisible()

  await page
    .getByRole("button", { name: /^fold product news and the weekly report/ })
    .click()
  await page.getByRole("button", { name: "Lock in" }).click()
  await expect(news).toBeHidden()
  await region.getByRole("button", { name: /More/ }).click()
  await expect(news).toBeVisible()
  await expect(
    page.getByText("Customized", { exact: true }).first()
  ).toBeVisible()

  const menu = page.getByRole("button", {
    name: "Customize the settings",
    exact: true,
  })
  await pickCustomize(menu, "Reset to default")
  await expect(menu).toBeFocused()
  await expect(region.getByRole("button", { name: /More/ })).toHaveCount(0)
})

test("shows the analytics dashboard with its recent orders", async ({
  page,
}) => {
  await page.goto("/examples/analytics")
  await expect(
    page.locator('[data-pliant-id="key-metrics"]')
  ).not.toHaveAttribute("data-pliant-pending")

  await page
    .getByRole("button", { name: "show the cards in a two-column grid" })
    .click()
  await expect(
    page.getByText("Arranged the metric cards in a two-column grid.")
  ).toBeVisible()
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
      page.getByRole("button", { name: /^Customize / }).first()
    ).toBeVisible()

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(390)
  })
}
