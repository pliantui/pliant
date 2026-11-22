import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

const pages = [
  ["pliant-root", "PliantRoot"],
  ["region", "Region"],
  ["pre-paint", "Pre-paint"],
  ["data-table", "Data Table"],
  ["form", "Form"],
  ["nav", "Nav"],
  ["ask-panel", "Ask Panel"],
  ["point-mode", "Point Mode"],
] as const

const sections = [
  "Installation",
  "Usage",
  "What users can ask",
  "Rules and guardrails",
  "Examples",
  "Options",
  "Accessibility",
]

function preview(page: Page) {
  return page.getByRole("tabpanel", { name: "Preview" })
}

test("lists every component by group and links to its page", async ({
  page,
  errors,
}) => {
  await page.goto("/docs/components")
  const main = page.getByRole("main")

  for (const group of ["Core", "Data", "Forms", "Navigation", "AI"]) {
    await expect(
      main.getByRole("heading", { level: 2, name: group, exact: true })
    ).toBeVisible()
  }
  await expect(
    main
      .getByRole("region", { name: "Core" })
      .getByRole("link", { name: "Region" })
  ).toHaveAttribute("href", "/docs/components/region")
  expect(errors).toEqual([])
})

test("sends the old components address to the index", async ({ page }) => {
  await page.goto("/components")
  await expect(page).toHaveURL("/docs/components")
})

for (const [slug, title] of pages) {
  test(`the ${title} page has a live preview and every section, in order`, async ({
    page,
    errors,
  }) => {
    await page.goto(`/docs/components/${slug}`)

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title)
    await expect(page.getByRole("tab", { name: "Preview" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await expect(
      preview(page).getByRole("button", { name: /^Reset / })
    ).toBeVisible()
    let previous = 0
    for (const section of sections) {
      const heading = page
        .getByRole("main")
        .getByRole("heading", { level: 2, name: section, exact: true })
      const box = await heading.boundingBox()
      expect(box, section).not.toBeNull()
      expect(box?.y ?? 0, `${section} comes next`).toBeGreaterThan(previous)
      previous = box?.y ?? 0
    }
    expect(errors).toEqual([])
  })
}

test("plays a recorded ask in the region preview, and resets it", async ({
  page,
  errors,
}) => {
  await page.goto("/docs/components/region")
  const region = preview(page).locator('[data-pliant-id="key-metrics"]')
  await expect(region).not.toHaveAttribute("data-pliant-pending")
  const cards = region.getByRole("group")

  await preview(page)
    .getByRole("button", { name: "put the overdue card first" })
    .click()
  await expect(cards.first()).toHaveAccessibleName("Overdue")
  await preview(page).getByRole("button", { name: "Lock in" }).click()
  await expect(
    preview(page).getByText("Customized", { exact: true })
  ).toBeVisible()

  await preview(page).getByRole("button", { name: "Reset key metrics" }).click()
  await expect(cards.first()).toHaveAccessibleName("Revenue")
  expect(errors).toEqual([])
})

test("shows the example's source in the Code tab", async ({ page, errors }) => {
  await page.goto("/docs/components/region")

  await page.getByRole("tab", { name: "Code" }).click()
  const code = page.getByRole("tabpanel", { name: "Code" })
  await expect(code).toContainText(
    'import { PliantRegion } from "@/components/pliant/pliant-region"'
  )
  await expect(code.getByRole("button", { name: /copy/i })).toBeVisible()
  // The Code tab shows code a reader can copy, not the site's demo wiring.
  await expect(code).not.toContainText("DemoFrame")
  await expect(code).not.toContainText("/replay")
  await expect(code).not.toContainText("@/lib/demo")
  expect(errors).toEqual([])
})

test("marks Components, not Docs, as the current section", async ({ page }) => {
  await page.goto("/docs/components/form")
  const nav = page.getByRole("navigation", { name: "Main" })

  await expect(nav.getByRole("link", { name: "Components" })).toHaveAttribute(
    "aria-current",
    "page"
  )
  await expect(nav.getByRole("link", { name: "Docs" })).not.toHaveAttribute(
    "aria-current",
    "page"
  )
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  for (const [slug] of pages) {
    test(`the ${slug} page fits the screen`, async ({ page }) => {
      await page.goto(`/docs/components/${slug}`)
      await expect(page.getByRole("tab", { name: "Preview" })).toBeVisible()
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
})
