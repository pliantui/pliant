import type { Locator, Page } from "@playwright/test"

import { expect, pickCustomize, test } from "./fixtures"

function block(page: Page, name: string | RegExp) {
  return page.getByRole("region", { name })
}

async function load(page: Page) {
  await page.goto("/blocks")
  await expect(
    page.locator('[data-pliant-id="key-metrics"]')
  ).not.toHaveAttribute("data-pliant-pending")
}

async function columnCount(region: Locator) {
  return region.evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length
  )
}

test("lists every block in the nav and shows each one", async ({
  page,
  errors,
}) => {
  await load(page)
  const nav = page.getByRole("navigation", { name: "Blocks" })

  for (const [label, description] of [
    ["Analytics dashboard", /^A dashboard with key metrics/],
    ["Orders list", /^A list of recent orders/],
    ["Ticket form", /^A support ticket form/],
    ["Settings page", /^An account settings page/],
    ["App sidebar", /^A support desk sidebar/],
    ["CRM pipeline", /^A sales pipeline board/],
    ["Team workspace", /^A team page/],
  ] as const) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible()
    const section = block(page, description)
    await expect(
      section.getByRole("button", { name: /^Customize / })
    ).toBeVisible()
    await expect(
      section.getByRole("group", { name: /^Ask about / }).first()
    ).toBeVisible()
  }
  expect(errors).toEqual([])
})

test("offers to add the published components a block uses", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await load(page)
  const orders = block(page, /^A list of recent orders/)

  await expect(
    orders.getByRole("heading", { name: /, Not fully implemented yet$/ })
  ).toBeVisible()
  const copy = orders.getByRole("button", {
    name: "Copy the command that adds the components this block uses: npx shadcn add @pliant/pliant-data-table",
  })
  await copy.click()
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("npx shadcn@latest add @pliant/pliant-data-table")
})

test("shows a block's files in the Code view and keeps its preview's changes", async ({
  page,
}) => {
  await load(page)
  const section = block(page, /^A sales pipeline board/)
  await section
    .getByRole("button", { name: /^flag deals with no activity in 14 days/ })
    .click()
  const flagged = section.getByText(/^No activity since /)
  await expect(flagged.first()).toBeVisible()

  await section.getByRole("tab", { name: "Code" }).click()
  const files = section.getByRole("list", { name: "Files" })
  await expect(
    files.getByRole("button", { name: "components/crm-pipeline.tsx" })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(section.locator("figure code")).toContainText(
    "export function CrmPipeline"
  )
  await expect(section.getByRole("region", { name: "Lead" })).toBeHidden()

  await expect(
    files.getByRole("button", { name: "lib/demo/schema.ts" })
  ).toBeVisible()

  await section.getByRole("tab", { name: "Preview" }).click()
  await expect(section.getByRole("region", { name: "Lead" })).toBeVisible()
  await expect(flagged.first()).toBeVisible()
})

test("shows the import paths an app would have in the Code view", async ({
  page,
}) => {
  await load(page)
  const section = block(page, /^A dashboard with key metrics/)
  await section.getByRole("tab", { name: "Code" }).click()

  const code = section.locator("figure code")
  await expect(code).toContainText('from "@/components/key-metrics"')

  await section
    .getByRole("button", { name: "components/key-metrics.tsx" })
    .click()
  await expect(code).toContainText('from "@/components/kpi-card"')
  await expect(code).toContainText('from "@/components/pliant/pliant-region"')

  await section
    .getByRole("button", { name: "components/demo-chart.tsx" })
    .click()
  await expect(code).toContainText("export function DemoChart")
})

test("reshapes the dashboard with recorded and scripted asks, and resets it", async ({
  page,
}) => {
  await load(page)
  const section = block(page, /^A dashboard with key metrics/)
  const metrics = section.locator('[data-pliant-id="key-metrics"]')
  const before = await columnCount(metrics)

  await section
    .getByRole("button", { name: "show the cards in a two-column grid" })
    .click()
  await expect(
    section.getByText("Arranged the metric cards in a two-column grid.")
  ).toBeVisible()
  await expect.poll(() => columnCount(metrics)).toBe(2)
  await section.getByRole("button", { name: "Lock in" }).click()
  await expect(section.getByText("Customized", { exact: true })).toBeVisible()

  const stack = section.getByRole("button", { name: /^stack by status/ })
  await stack.click()
  await expect(stack).toHaveAttribute("aria-pressed", "true")
  await expect(
    section.getByText("By month, Jan–Oct 2026, split by status")
  ).toBeVisible()

  const reset = section.getByRole("button", { name: "Customize the dashboard" })
  await pickCustomize(reset, "Reset to default")
  await expect(section.getByText("Customized", { exact: true })).toBeHidden()
  await expect(reset).toBeFocused()
  await expect(stack).toHaveAttribute("aria-pressed", "false")
  await expect(
    section.getByText("By month, Jan–Oct 2026", { exact: true })
  ).toBeVisible()
  await expect.poll(() => columnCount(metrics)).toBe(before)
})

test("lays the pipeline out in two columns with Pliant, and resets it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await load(page)
  const section = block(page, /^A sales pipeline board/)
  const columns = section.locator('[data-pliant-id="crm-pipeline"]')
  await expect(columns).not.toHaveAttribute("data-pliant-pending")
  const before = await columnCount(columns)
  expect(before).toBeGreaterThan(2)

  await section
    .getByRole("button", { name: /^show the stages in two columns/ })
    .click()
  await expect(
    section.getByText("Laid the stages out in two columns.")
  ).toBeVisible()
  await section.getByRole("button", { name: "Lock in" }).click()
  await expect.poll(() => columnCount(columns)).toBe(2)
  await expect(section.getByText("Customized", { exact: true })).toBeVisible()

  const reset = section.getByRole("button", { name: "Customize the pipeline" })
  await pickCustomize(reset, "Reset to default")
  await expect.poll(() => columnCount(columns)).toBe(before)
  await expect(reset).toBeFocused()
})

test("shows stage totals, and a second press takes them back", async ({
  page,
}) => {
  await load(page)
  const section = block(page, /^A sales pipeline board/)
  const ask = section.getByRole("button", {
    name: /^show the total for each stage/,
  })
  const lead = section.getByRole("heading", { name: /^Lead/ })

  await ask.click()
  await expect(lead).toContainText("₹")
  await ask.click()
  await expect(lead).not.toContainText("₹")
})

test("stacks the workspace panels and previews the team default", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await load(page)
  const section = block(page, /^A team page/)
  const panels = section
    .locator('[data-pliant-id="team-workspace"]')
    .locator('[data-slot="card"]')
  const lefts = () =>
    panels.evaluateAll((cards) =>
      cards.map((card) => Math.round(card.getBoundingClientRect().left))
    )
  expect(new Set(await lefts()).size).toBeGreaterThan(1)

  await section
    .getByRole("button", { name: /^show the panels in one column/ })
    .click()
  await expect(
    section.getByText("Stacked the panels in one column.")
  ).toBeVisible()
  await expect.poll(async () => new Set(await lefts()).size).toBe(1)
  await section.getByRole("button", { name: "Lock in" }).click()

  await section
    .getByRole("button", { name: /^publish this layout for my team/ })
    .click()
  await expect(section.getByText("Team default")).toBeVisible()

  await pickCustomize(
    section.getByRole("button", { name: "Customize the workspace" }),
    "Reset to default"
  )
  await expect(section.getByText("Team default")).toBeHidden()
  await expect(section.getByText("Saved by the team.")).toBeVisible()
})

test("shows the team's defaults on the settings page", async ({ page }) => {
  await load(page)
  const section = block(page, /^An account settings page/)
  const weekly = section.getByRole("checkbox", { name: /^Weekly report/ })
  await expect(weekly).not.toBeChecked()

  await section.getByRole("button", { name: /^use my team's defaults/ }).click()
  await expect(weekly).toBeChecked()
  await expect(section.getByText("Team default").first()).toBeVisible()
})

test("fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await load(page)

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390)
})

test("gives every element on the page its own id", async ({ page }) => {
  await load(page)

  const ids = await page
    .locator("[id]")
    .evaluateAll((elements) => elements.map((element) => element.id))
  expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([])
})
