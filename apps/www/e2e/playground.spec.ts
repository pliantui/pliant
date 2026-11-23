import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

function step(page: Page, name: string) {
  return page.getByRole("region", { name })
}

test("asks for a change, compares it with the start, and resets it", async ({
  page,
  errors,
}) => {
  await page.goto("/playground")
  const compare = step(page, "Compare before and after")
  const json = page.getByRole("region", { name: "Overlay JSON" })
  await expect(json).toContainText("No changes yet")

  await step(page, "Ask for a change")
    .getByRole("button", {
      name: /^add a column for days since each order was placed/,
    })
    .click()
  await expect(
    step(page, "Ask for a change").getByText("Added a Days since order column.")
  ).toBeVisible()
  await expect(compare.getByText("Customized", { exact: true })).toBeVisible()
  const days = compare.getByRole("columnheader", { name: /^Days since order/ })
  await expect(days).toBeVisible()
  await expect(json).toContainText('"op": "addDerived"')
  await expect(json).toContainText('"fn": "dateDiff"')

  await compare.getByRole("radio", { name: "Before" }).click()
  await expect(days).toHaveCount(0)
  await compare.getByRole("radio", { name: "After" }).click()
  await expect(days).toBeVisible()

  const reset = compare.getByRole("button", { name: "Reset orders table" })
  await reset.click()
  await expect(reset).toBeFocused()
  await expect(days).toHaveCount(0)
  await expect(json).toContainText("No changes yet")
  expect(errors).toEqual([])
})

test("shows each example's asks, scripted where there's no recording", async ({
  page,
}) => {
  await page.goto("/playground")
  await step(page, "Pick an example")
    .getByRole("radio", { name: /^Ticket form/ })
    .click()

  const asks = page.getByRole("group", { name: "Ask about ticket form" })
  await expect(
    asks.getByRole("button", {
      name: /^default priority to High for me.*Scripted$/,
    })
  ).toBeVisible()
  await asks
    .getByRole("button", { name: /^fold the order number and CC/ })
    .click()
  await expect(page.getByRole("textbox", { name: "CC" })).toBeHidden()
  await expect(
    page.getByRole("button", { name: "More fields", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("region", { name: "Overlay JSON" })
  ).toContainText('"op": "collapse"')
})

test("answers only the suggested asks when asked in your own words", async ({
  page,
}) => {
  await page.goto("/playground")
  const box = page.getByRole("textbox", { name: "Or ask in your own words" })

  await box.fill("make everything purple")
  await box.press("Enter")
  await expect(
    page.getByText("This demo only answers its recorded asks.", {
      exact: false,
    })
  ).toBeVisible()

  await box.fill("highlight overdue orders over ₹1L")
  await page.getByRole("button", { name: "Ask", exact: true }).click()
  await expect(
    step(page, "Ask for a change").getByText(
      "Highlighted the overdue orders worth more than ₹1,00,000."
    )
  ).toBeVisible()
  await expect(
    page.getByRole("region", { name: "Overlay JSON" })
  ).toContainText('"op": "addHighlight"')
  // Of the latest 12 orders, only these are overdue and over ₹1,00,000.
  const highlighted = step(page, "Compare before and after")
    .getByRole("row")
    .filter({ hasText: "Highlighted" })
  await expect(highlighted).toHaveCount(2)
  await expect(highlighted.filter({ hasText: "ORD-1194" })).toHaveCount(1)
  await expect(highlighted.filter({ hasText: "ORD-1129" })).toHaveCount(1)
})

test("suggests one of the picked example's asks in the text box", async ({
  page,
}) => {
  await page.goto("/playground")
  const box = page.getByRole("textbox", { name: "Or ask in your own words" })
  await expect(box).toHaveAttribute(
    "placeholder",
    "add a column for days since each order was placed"
  )

  await step(page, "Pick an example")
    .getByRole("radio", { name: /^Sidebar/ })
    .click()
  await expect(box).toHaveAttribute("placeholder", "open Tickets when I log in")
})

test("fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/playground")
  await expect(step(page, "What changed")).toBeVisible()

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390)
})

test("keeps every id on the page unique when comparing", async ({ page }) => {
  await page.goto("/playground")
  await step(page, "Pick an example")
    .getByRole("radio", { name: "Ticket form" })
    .click()
  const compare = step(page, "Compare before and after")

  for (const view of ["Before", "After"]) {
    await compare.getByRole("radio", { name: view }).click()
    const ids = await page
      .locator("[id]")
      .evaluateAll((elements) => elements.map((element) => element.id))
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([])
  }
})
