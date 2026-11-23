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
  await expect(panel.getByRole("log", { name: "Conversation" })).toContainText(
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
          name: /^Your app, shaped by/,
        })
      ).toBeVisible()
      expect(await violations(page, colorScheme)).toEqual([])
    })

    test("the home page's Data and Changes tabs have no accessibility violations", async ({
      page,
    }) => {
      await page.goto("/")
      const preview = page.getByRole("tabpanel", { name: "Preview" })
      await expect(
        preview.locator('[data-pliant-id="acme-sections"]')
      ).not.toHaveAttribute("data-pliant-pending")
      await preview
        .getByRole("group", { name: "Ask about the sections table" })
        .getByRole("button", { name: /^only show Eddie Lake/ })
        .click()
      await expect(
        preview.getByRole("button", { name: "Lock in" })
      ).toBeVisible()
      expect(await violations(page, colorScheme)).toEqual([])

      await page.getByRole("tab", { name: "Data" }).click()
      await expect(
        page.getByText("In server mode, Pliant compiles this filter to:")
      ).toBeVisible()
      expect(await violations(page, colorScheme)).toEqual([])

      await page.getByRole("tab", { name: "Changes" }).click()
      await expect(page.getByLabel("Overlay")).toBeVisible()
      expect(await violations(page, colorScheme)).toEqual([])
    })

    for (const [slug, name] of [
      ["", "Components"],
      ["/pliant-root", "PliantRoot"],
      ["/region", "Region"],
      ["/pre-paint", "Pre-paint"],
      ["/ask-panel", "Ask Panel"],
      ["/data-table", "Data Table"],
      ["/form", "Form"],
      ["/nav", "Nav"],
      ["/point-mode", "Point Mode"],
      ["/messages", "Messages"],
      ["/chart", "Chart"],
      ["/stat", "Stat"],
      ["/list", "List"],
      ["/tabs-and-panels", "Tabs and Panels"],
      ["/actions", "Actions"],
      ["/dialog", "Dialog"],
      ["/suggestions", "Suggestions"],
      ["/customized-indicator", "Customized Indicator"],
      ["/reset", "Reset"],
      ["/history-and-undo", "History and Undo"],
      ["/share-link", "Share Link"],
      ["/team-publish", "Team Publish"],
      ["/text-size-density-motion", "Text Size, Density and Motion"],
    ] as const) {
      test(`the ${name} component page has no accessibility violations`, async ({
        page,
      }) => {
        await page.goto(`/docs/components${slug}`)
        await expect(
          page.getByRole("heading", { level: 1, name, exact: true })
        ).toBeVisible()
        expect(await violations(page, colorScheme)).toEqual([])
      })
    }

    test("a component page's Code tab and Manual install have no accessibility violations", async ({
      page,
    }) => {
      await page.goto("/docs/components/region")
      await page.getByRole("tab", { name: "Code" }).click()
      await page.getByRole("tab", { name: "Manual" }).click()
      await expect(
        page.getByRole("tabpanel", { name: "Manual" }).getByRole("heading", {
          name: "Install the dependencies.",
        })
      ).toBeVisible()
      expect(await violations(page, colorScheme)).toEqual([])
    })

    for (const [path, name] of [
      ["/blocks", "Blocks"],
      ["/charts", "Charts"],
      ["/playground", "Playground"],
      ["/templates", "Templates"],
    ] as const) {
      test(`the ${name.toLowerCase()} section has no accessibility violations`, async ({
        page,
      }) => {
        await page.goto(path)
        await expect(
          page.getByRole("heading", { level: 1, name })
        ).toBeVisible()
        expect(await violations(page, colorScheme)).toEqual([])
      })
    }

    test("a block's Code view has no accessibility violations", async ({
      page,
    }) => {
      await page.goto("/blocks")
      const block = page.getByRole("region", {
        name: /^A list of recent orders/,
      })
      await block.getByRole("tab", { name: "Code" }).click()
      await expect(block.getByRole("list", { name: "Files" })).toBeVisible()
      expect(await violations(page, colorScheme)).toEqual([])
    })

    for (const path of [
      "/examples/crm",
      "/examples/settings",
      "/examples/analytics",
      "/examples/team-workspace/inbox",
    ]) {
      test(`the ${path} example has no accessibility violations`, async ({
        page,
      }) => {
        await page.goto(path)
        await expect(
          page.getByRole("button", { name: /^Reset / }).first()
        ).toBeVisible()
        expect(await violations(page, colorScheme)).toEqual([])
      })
    }

    test("the playground's before view and overlay have no accessibility violations", async ({
      page,
    }) => {
      await page.goto("/playground")
      await page
        .getByRole("button", {
          name: /^show each order's share of total value/,
        })
        .click()
      await page.getByRole("radio", { name: "Before" }).click()
      await expect(
        page.getByRole("region", { name: "Overlay JSON" })
      ).toContainText('"op": "addDerived"')
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
        page.getByRole("heading", {
          level: 1,
          name: "Expressions and functions",
        })
      ).toBeVisible()
      expect(await violations(page, colorScheme)).toEqual([])
    })

    test("a docs page with code comments has no accessibility violations", async ({
      page,
    }) => {
      await page.goto("/docs/ai")
      await expect(
        page.getByRole("heading", { level: 1, name: "How asking works" })
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
      await page.goto("/examples/team-workspace/inbox")
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
          page.getByRole("heading", { level: 1, name: "Overlays and layers" })
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
        await expect(
          panel.getByRole("log", { name: "Conversation" })
        ).toBeInViewport({ ratio: 1 })
        expect(await violations(page, colorScheme)).toEqual([])
      })
    })
  })
}
