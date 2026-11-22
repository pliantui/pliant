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
    .getByRole("button", { name: "hide the notes column" })
    .click()
  await expect(page.getByRole("status")).toHaveText(
    "Hid the Notes column from the orders table."
  )
  await expect(compare.getByText("Customized", { exact: true })).toBeVisible()
  await expect(
    compare.getByRole("columnheader", { name: /^Notes/ })
  ).toHaveCount(0)
  await expect(json).toContainText('"op": "hide"')
  await expect(json).toContainText('"target": "orders-table/columns/notes"')

  await compare.getByRole("button", { name: "Before" }).click()
  await expect(
    compare.getByRole("columnheader", { name: /^Notes/ })
  ).toBeVisible()
  await compare.getByRole("button", { name: "After" }).click()
  await expect(
    compare.getByRole("columnheader", { name: /^Notes/ })
  ).toHaveCount(0)

  const reset = compare.getByRole("button", { name: "Reset orders table" })
  await reset.click()
  await expect(reset).toBeFocused()
  await expect(
    compare.getByRole("columnheader", { name: /^Notes/ })
  ).toBeVisible()
  await expect(json).toContainText("No changes yet")
  expect(errors).toEqual([])
})

test("shows each example's asks, scripted where there's no recording", async ({
  page,
}) => {
  await page.goto("/playground")
  await step(page, "Pick an example")
    .getByRole("button", { name: /^Ticket form/ })
    .click()

  const asks = page.getByRole("group", { name: "Ask about ticket form" })
  await expect(
    asks.getByRole("button", { name: /^put priority first.*Scripted$/ })
  ).toBeVisible()
  await asks.getByRole("button", { name: /^hide the CC field/ }).click()
  await expect(page.getByRole("textbox", { name: "CC" })).toHaveCount(0)
  await expect(
    page.getByRole("region", { name: "Overlay JSON" })
  ).toContainText('"source": "chip"')
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

  await box.fill("sort by value, highest first")
  await page.getByRole("button", { name: "Ask", exact: true }).click()
  await expect(page.getByRole("status")).toHaveText(
    "Sorted by value, highest first."
  )
})

test("fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/playground")
  await expect(step(page, "What changed")).toBeVisible()

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(390)
})
