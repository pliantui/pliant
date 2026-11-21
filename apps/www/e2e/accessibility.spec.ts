import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

const surface = "/examples/orders"

type ColorScheme = "light" | "dark"

// `include` scans only the matching elements, such as an open menu, whose
// modal leaves the rest of the page hidden from assistive technology.
async function violations(
  page: Page,
  colorScheme: ColorScheme,
  include?: string
) {
  await expect(page.locator("html")).toHaveCSS("color-scheme", colorScheme)
  // Scan once the entrance animations have ended: colors mid-fade fail contrast.
  // Scroll-driven animations, like the fading edges of scroll areas, never end.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.timeline instanceof DocumentTimeline &&
            animation.effect?.getComputedTiming().iterations !== Infinity
        )
        .map((animation) => animation.finished.catch(() => undefined))
    )
  )
  const builder = new AxeBuilder({ page })
  if (include) {
    builder.include(include)
  }
  const results = await builder
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

    test("a docs page with code, a callout and a table has no accessibility violations", async ({
      page,
    }) => {
      await page.goto("/docs/concepts/expressions")
      await expect(
        page.getByRole("heading", { level: 1, name: "Expressions" })
      ).toBeVisible()
      expect(await violations(page, colorScheme)).toEqual([])
    })

    test("the search dialog has no accessibility violations", async ({
      page,
    }) => {
      await page.goto("/docs")
      await page.keyboard.press("ControlOrMeta+k")
      const dialog = page.getByRole("dialog", { name: /^Search/ })
      await dialog
        .getByRole("combobox", { name: "Search documentation" })
        .fill("overlay")
      await expect(
        dialog.getByRole("group", { name: "Search Results" })
      ).toBeVisible()
      expect(await violations(page, colorScheme)).toEqual([])
    })

    test("the orders example has no accessibility violations", async ({
      page,
    }) => {
      await loadOrders(page)
      expect(await violations(page, colorScheme)).toEqual([])
    })

    test("highlighted orders have no accessibility violations", async ({
      page,
    }) => {
      await loadOrders(page)
      for (const name of ["Over ₹1,00,000", "Overdue", "Largest in group"]) {
        await page.getByRole("button", { name: "Highlight" }).click()
        await page.getByRole("menuitemcheckbox", { name }).click()
        await expect(page.getByRole("menu")).toBeHidden()
      }
      await expect(page.getByText(/^Highlighted: /).first()).toBeAttached()
      expect(await violations(page, colorScheme)).toEqual([])
    })

    test("the table toolbar has no accessibility violations", async ({
      page,
    }) => {
      await loadOrders(page)
      await page.getByRole("searchbox", { name: "Customer" }).fill("a")
      await page
        .getByRole("button", { name: "Status", expanded: false })
        .click()
      await page.getByRole("menuitemcheckbox", { name: /^Overdue/ }).click()
      await expect(
        page.getByRole("menuitemcheckbox", { name: /^Overdue/ })
      ).toBeChecked()
      expect(await violations(page, colorScheme, '[role="menu"]')).toEqual([])
      await page.keyboard.press("Escape")
      await expect(
        page.getByRole("button", { name: "Reset", exact: true })
      ).toBeVisible()
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

    test("the app example's sidebar has no accessibility violations", async ({
      page,
    }) => {
      await page.goto("/examples/app/inbox")
      await expect(
        page.locator('[data-pliant-id="app-sidebar"]')
      ).not.toHaveAttribute("data-pliant-pending")
      await page.getByRole("button", { name: "Inbox options" }).focus()
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

      test("a docs page has no accessibility violations", async ({ page }) => {
        await page.goto("/docs/concepts/layers")
        await expect(
          page.getByRole("heading", { level: 1, name: "Layers" })
        ).toBeVisible()
        expect(await violations(page, colorScheme)).toEqual([])
      })

      test("the menu has no accessibility violations", async ({ page }) => {
        await page.goto("/docs")
        await page.getByRole("button", { name: "Menu" }).click()
        await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible()
        expect(await violations(page, colorScheme)).toEqual([])
      })

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
