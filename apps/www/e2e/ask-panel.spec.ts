import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

const surface = "/examples/orders"

async function slotOrder(page: Page) {
  return page
    .locator('[data-pliant-id="key-metrics"] > [data-pliant-id]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-pliant-id"))
    )
}

async function askForOverdueFirst(page: Page) {
  await page.goto(surface)
  await expect(
    page.locator('[data-pliant-id="key-metrics"]')
  ).not.toHaveAttribute("data-pliant-pending")
  await page.getByRole("button", { name: "Ask" }).click()
  const panel = page.getByRole("dialog", { name: "Ask" })
  await expect(panel.getByRole("combobox", { name: "Change" })).toHaveText(
    "Key metrics"
  )
  const prompt = panel.getByRole("textbox", { name: "Ask" })
  await expect(prompt).toBeFocused()
  await prompt.fill("put the overdue card first")
  await prompt.press("Enter")
  await expect(panel.getByRole("status")).toContainText(
    "Moved the Overdue card to the first position."
  )
  return panel
}

const base = ["revenue", "orders", "average-order-value", "overdue"]
const overdueFirst = ["overdue", "revenue", "orders", "average-order-value"]

test("previews an answer and keeps it after Lock in", async ({
  page,
  errors,
}) => {
  const panel = await askForOverdueFirst(page)
  expect(await slotOrder(page)).toEqual(overdueFirst)

  await panel.getByRole("button", { name: "Lock in" }).click()
  await expect(panel.getByRole("status")).toHaveText("Locked in.")

  await page.reload()
  await expect(
    page.locator('[data-pliant-id="key-metrics"]')
  ).not.toHaveAttribute("data-pliant-pending")
  expect(await slotOrder(page)).toEqual(overdueFirst)
  expect(errors).toEqual([])
})

test("drops the preview on Discard", async ({ page, errors }) => {
  const panel = await askForOverdueFirst(page)
  expect(await slotOrder(page)).toEqual(overdueFirst)

  await panel.getByRole("button", { name: "Discard" }).click()
  await expect(panel.getByRole("status")).toHaveText("Discarded.")
  expect(await slotOrder(page)).toEqual(base)

  await page.reload()
  await expect(
    page.locator('[data-pliant-id="key-metrics"]')
  ).not.toHaveAttribute("data-pliant-pending")
  expect(await slotOrder(page)).toEqual(base)
  expect(errors).toEqual([])
})

test("shows a clarifying question about the orders table", async ({
  page,
  errors,
}) => {
  await page.goto(surface)
  await page.getByRole("button", { name: "Ask" }).click()
  const panel = page.getByRole("dialog", { name: "Ask" })
  await panel.getByRole("combobox", { name: "Change" }).click()
  await page.getByRole("option", { name: "Orders table" }).click()
  const prompt = panel.getByRole("textbox", { name: "Ask" })
  await prompt.fill("make it nicer")
  await prompt.press("Enter")

  await expect(panel.getByRole("status")).toContainText(
    "What would make the orders table nicer for you"
  )
  await page.keyboard.press("Escape")
  await expect(panel).toBeHidden()
  await expect(page.getByRole("button", { name: "Ask" })).toBeFocused()
  expect(errors).toEqual([])
})

async function askAboutKeyMetrics(page: Page, prompt: string, answer: string) {
  await page.goto(surface)
  await page.getByRole("button", { name: "Ask" }).click()
  const panel = page.getByRole("dialog", { name: "Ask" })
  await panel.getByRole("textbox", { name: "Ask" }).fill(prompt)
  await panel.getByRole("button", { name: "Send" }).click()
  await expect(panel.getByRole("status")).toContainText(answer)
}

test("previews hiding a card", async ({ page, errors }) => {
  await askAboutKeyMetrics(
    page,
    "hide the average order value card",
    "Hid the Average order value card"
  )

  await expect(
    page.getByRole("group", { name: "Average order value" })
  ).toBeHidden()
  await expect(page.getByRole("group", { name: "Revenue" })).toBeVisible()
  expect(errors).toEqual([])
})

test("previews a two-column grid", async ({ page, errors }) => {
  await askAboutKeyMetrics(
    page,
    "show the cards in a two-column grid",
    "Arranged the metric cards in a two-column grid."
  )

  const tops = await page
    .locator('[data-pliant-id="key-metrics"]')
    .getByRole("group")
    .evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().top)
    )
  expect(new Set(tops).size).toBe(2)
  expect(errors).toEqual([])
})
