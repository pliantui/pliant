import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

const surface = "/examples/orders"

type ColorScheme = "light" | "dark"

async function violations(page: Page, colorScheme: ColorScheme) {
  await expect(page.locator("html")).toHaveCSS("color-scheme", colorScheme)
  // Scan once the entrance animations have ended: colors mid-fade fail contrast.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity
        )
        .map((animation) => animation.finished.catch(() => undefined))
    )
  )
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
  await page.goto(surface)
  await expect(
    page.locator('[data-pliant-id="key-metrics"]')
  ).not.toHaveAttribute("data-pliant-pending")
  await expect(page.getByRole("table", { name: "All orders" })).toBeVisible()
}

async function openPanel(page: Page) {
  await loadOrders(page)
  await page.getByRole("button", { name: "Ask" }).click()
  const panel = page.getByRole("complementary", { name: "Ask" })
  await expect(panel.getByRole("textbox", { name: "Ask" })).toBeFocused()
  return panel
}

async function askForPreview(page: Page) {
  const panel = await openPanel(page)
  const textbox = panel.getByRole("textbox", { name: "Ask" })
  await textbox.fill("put the overdue card first")
  await textbox.press("Enter")
  await expect(panel.getByRole("status")).toContainText(
    "Moved the Overdue card to the first position."
  )
  await expect(panel.getByRole("button", { name: "Lock in" })).toBeVisible()
  return panel
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`in ${colorScheme} mode`, () => {
    test.use({ colorScheme })

    test("the home page has no accessibility violations", async ({ page }) => {
      await page.goto("/")
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /^Build pliant interfaces/,
        })
      ).toBeVisible()
      expect(await violations(page, colorScheme)).toEqual([])
    })

    test("the 404 page has no accessibility violations", async ({ page }) => {
      await page.goto("/no-such-page")
      await expect(
        page.getByRole("heading", { level: 1, name: "Page not found" })
      ).toBeVisible()
      expect(await violations(page, colorScheme)).toEqual([])
    })

    test("a docs page has no accessibility violations", async ({ page }) => {
      await page.goto("/docs")
      await expect(
        page.getByRole("heading", { level: 1, name: "Introduction" })
      ).toBeVisible()
      expect(await violations(page, colorScheme)).toEqual([])
    })

    test("the orders example has no accessibility violations", async ({
      page,
    }) => {
      await loadOrders(page)
      expect(await violations(page, colorScheme)).toEqual([])
    })

    test("the tickets example has no accessibility violations", async ({
      page,
    }) => {
      await page.goto("/examples/tickets")
      await expect(
        page.locator('[data-pliant-id="ticket-form"]')
      ).not.toHaveAttribute("data-pliant-pending")
      await page.getByRole("button", { name: "Submit ticket" }).click()
      await expect(page.getByText("Subject must be at least")).toBeVisible()
      expect(await violations(page, colorScheme)).toEqual([])
    })

    test("the ask panel has no accessibility violations", async ({ page }) => {
      await openPanel(page)
      expect(await violations(page, colorScheme)).toEqual([])
    })

    test("an answer preview has no accessibility violations", async ({
      page,
    }) => {
      await askForPreview(page)
      expect(await violations(page, colorScheme)).toEqual([])
    })

    test("point mode has no accessibility violations", async ({ page }) => {
      await loadOrders(page)
      await page.getByRole("button", { name: "Point" }).click()
      await expect(
        page.getByRole("dialog", { name: "Point mode" })
      ).toBeVisible()
      await expect(
        page
          .locator('[data-slot="pliant-point-mode"]')
          .getByRole("button", { name: "Key metrics" })
      ).toBeFocused()
      expect(await violations(page, colorScheme)).toEqual([])
    })

    test.describe("on a small screen", () => {
      test.use({ viewport: { width: 390, height: 844 } })

      test("the docked ask panel has no accessibility violations", async ({
        page,
      }) => {
        const panel = await askForPreview(page)
        await expect(panel.getByRole("status")).toBeInViewport({ ratio: 1 })
        expect(await violations(page, colorScheme)).toEqual([])
      })
    })
  })
}
