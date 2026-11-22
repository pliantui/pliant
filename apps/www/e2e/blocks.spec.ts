import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

function block(page: Page, name: string | RegExp) {
  return page.getByRole("region", { name })
}

async function load(page: Page) {
  await page.goto("/blocks")
  await expect(
    page.locator('[data-pliant-id="key-metrics"]')
  ).not.toHaveAttribute("data-pliant-pending")
}

async function metricOrder(page: Page) {
  return page
    .locator('[data-pliant-id="key-metrics"]')
    .getByRole("group")
    .evaluateAll((groups) =>
      groups.map((group) => group.textContent.split(/[₹\d]/)[0])
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
    await expect(section.getByRole("button", { name: /^Reset / })).toBeVisible()
    await expect(
      section.getByRole("group", { name: /^Ask about / }).first()
    ).toBeVisible()
  }
  expect(errors).toEqual([])
})

test("offers shadcn add only for components in the registry", async ({
  page,
}) => {
  await load(page)

  await expect(
    block(page, /^A list of recent orders/).getByRole("button", {
      name: "Copy npx shadcn add pliant-data-table",
    })
  ).toBeVisible()
  const pipeline = block(page, /^A sales pipeline board/)
  await expect(pipeline.getByText("Not published yet")).toBeVisible()
  await expect(
    pipeline.getByRole("button", { name: /^Copy npx shadcn add/ })
  ).toHaveCount(0)
})

test("shows a block's files in the Code view and keeps its preview's changes", async ({
  page,
}) => {
  await load(page)
  const section = block(page, /^A sales pipeline board/)
  await section.getByRole("button", { name: /^hide the won column/ }).click()

  await section.getByRole("tab", { name: "Code" }).click()
  const files = section.getByRole("list", { name: "Files" })
  await expect(
    files.getByRole("button", { name: "components/crm-pipeline.tsx" })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(section.locator("figure code")).toContainText(
    "export function CrmPipeline"
  )
  await expect(section.getByRole("region", { name: "Lead" })).toBeHidden()

  await section.getByRole("tab", { name: "Preview" }).click()
  await expect(section.getByRole("region", { name: "Lead" })).toBeVisible()
  await expect(section.getByRole("region", { name: "Won" })).toHaveCount(0)
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
  const before = await metricOrder(page)

  await section
    .getByRole("button", { name: "put the overdue card first" })
    .click()
  await expect(
    section.getByText("Moved the Overdue card to the first position.")
  ).toBeVisible()
  expect(await metricOrder(page)).toEqual([
    "Overdue",
    ...before.filter((name) => name !== "Overdue"),
  ])
  await section.getByRole("button", { name: "Lock in" }).click()
  await expect(section.getByText("Customized", { exact: true })).toBeVisible()

  const stack = section.getByRole("button", { name: /^stack by status/ })
  await stack.click()
  await expect(stack).toHaveAttribute("aria-pressed", "true")
  await expect(
    section.getByText("By month, Jan–Oct 2026, split by status")
  ).toBeVisible()

  const reset = section.getByRole("button", { name: "Reset the dashboard" })
  await reset.click()
  await expect(section.getByText("Customized", { exact: true })).toBeHidden()
  await expect(reset).toBeFocused()
  await expect(stack).toHaveAttribute("aria-pressed", "false")
  await expect(
    section.getByText("By month, Jan–Oct 2026", { exact: true })
  ).toBeVisible()
  expect(await metricOrder(page)).toEqual(before)
})

test("hides a pipeline column, and a second press brings it back", async ({
  page,
}) => {
  await load(page)
  const section = block(page, /^A sales pipeline board/)
  const ask = section.getByRole("button", { name: /^hide the won column/ })

  await ask.click()
  await expect(section.getByRole("region", { name: "Won" })).toHaveCount(0)
  await expect(section.getByText("Customized", { exact: true })).toBeVisible()

  await ask.click()
  await expect(section.getByRole("region", { name: "Won" })).toBeVisible()
  await expect(section.getByText("Customized", { exact: true })).toBeHidden()
})

test("hides a workspace panel and previews the team default", async ({
  page,
}) => {
  await load(page)
  const section = block(page, /^A team page/)

  await section.getByRole("button", { name: /^hide shared views/ }).click()
  await expect(section.getByText("Hid the Shared views panel.")).toBeVisible()
  await expect(section.getByText("Saved by the team.")).toBeHidden()
  await section.getByRole("button", { name: "Lock in" }).click()

  await section
    .getByRole("button", { name: /^publish this layout for my team/ })
    .click()
  await expect(section.getByText("Team default")).toBeVisible()

  await section.getByRole("button", { name: "Reset the workspace" }).click()
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
