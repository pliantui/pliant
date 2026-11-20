import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

async function violations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze()
  return results.violations.map(({ id, impact, help, nodes }) => ({
    id,
    impact,
    help,
    targets: nodes.map((node) => node.html),
  }))
}

async function loadOrders(page: Page) {
  await page.goto("/examples/orders")
  await expect(
    page.locator('[data-pliant-id="key-metrics"]')
  ).not.toHaveAttribute("data-pliant-pending")
  await expect(page.getByRole("table", { name: "All orders" })).toBeVisible()
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`in ${colorScheme} mode`, () => {
    test.use({ colorScheme })

    test("the home page has no accessibility violations", async ({ page }) => {
      await page.goto("/")
      await expect(
        page.getByRole("heading", { level: 1, name: "Pliant" })
      ).toBeVisible()
      expect(await violations(page)).toEqual([])
    })

    test("a docs page has no accessibility violations", async ({ page }) => {
      await page.goto("/docs")
      await expect(
        page.getByRole("heading", { level: 1, name: "Introduction" })
      ).toBeVisible()
      expect(await violations(page)).toEqual([])
    })

    test("the orders example has no accessibility violations", async ({
      page,
    }) => {
      await loadOrders(page)
      expect(await violations(page)).toEqual([])
    })

    test("the orders example has no accessibility violations with the ask panel open", async ({
      page,
    }) => {
      await loadOrders(page)
      await page.getByRole("button", { name: "Ask" }).click()
      const panel = page.getByRole("complementary", { name: "Ask" })
      await expect(panel.getByRole("textbox", { name: "Ask" })).toBeFocused()
      expect(await violations(page)).toEqual([])
    })
  })
}
