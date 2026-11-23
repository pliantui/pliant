import type { Page } from "@playwright/test"

import { expect, pickCustomize, test } from "./fixtures"

const surface = "/examples/orders"
const overdueFirst = ["overdue", "revenue", "orders", "average-order-value"]
const base = ["revenue", "orders", "average-order-value", "overdue"]

function region(page: Page) {
  return page.locator('[data-pliant-id="key-metrics"]')
}

function panel(page: Page) {
  return page.getByRole("complementary", { name: "Ask" })
}

function log(page: Page) {
  return panel(page).getByRole("log", { name: "Conversation" })
}

async function slotOrder(page: Page) {
  return region(page)
    .locator(":scope > [data-pliant-id]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-pliant-id"))
    )
}

async function openPanel(page: Page) {
  await expect(region(page)).not.toHaveAttribute("data-pliant-pending")
  await pickCustomize(
    page.getByRole("button", { name: "Customize the orders page" }),
    "Ask for a change…"
  )
  await expect(panel(page).getByRole("textbox", { name: "Ask" })).toBeFocused()
}

async function ask(page: Page, prompt: string) {
  const textbox = panel(page).getByRole("textbox", { name: "Ask" })
  await textbox.fill(prompt)
  await textbox.press("Enter")
  await expect(textbox).toHaveValue("")
}

test.beforeEach(async ({ page }) => {
  await page.goto(surface)
  await openPanel(page)
})

test("answers in the chat with its steps and an inline preview", async ({
  page,
  errors,
}) => {
  await ask(page, "put the overdue card first")

  await expect(log(page)).toContainText("put the overdue card first")
  await expect(log(page)).toContainText(
    "Moved the Overdue card to the first position."
  )
  await expect(log(page).getByRole("listitem")).toHaveText([
    "Chose an operation: Move",
    "Checked the change against the rules for Key metrics",
  ])
  const preview = log(page).getByRole("group", { name: "Preview" })
  await expect(preview.getByRole("button", { name: "Lock in" })).toBeVisible()
  await expect(preview.getByRole("button", { name: "Discard" })).toBeVisible()
  expect(await slotOrder(page)).toEqual(overdueFirst)
  expect(errors).toEqual([])
})

test("applies the preview only on Lock in", async ({ page, errors }) => {
  await ask(page, "put the overdue card first")
  const preview = log(page).getByRole("group", { name: "Preview" })

  await preview.getByRole("button", { name: "Lock in" }).click()

  await expect(preview).toContainText("Locked in.")
  await expect(preview.getByRole("button", { name: "Lock in" })).toBeHidden()
  await page.reload()
  await expect(region(page)).not.toHaveAttribute("data-pliant-pending")
  expect(await slotOrder(page)).toEqual(overdueFirst)
  expect(errors).toEqual([])
})

test("leaves the page as it was on Discard", async ({ page, errors }) => {
  await ask(page, "put the overdue card first")
  const preview = log(page).getByRole("group", { name: "Preview" })

  await preview.getByRole("button", { name: "Discard" }).click()

  await expect(preview).toContainText("Discarded.")
  expect(await slotOrder(page)).toEqual(base)
  await page.reload()
  await expect(region(page)).not.toHaveAttribute("data-pliant-pending")
  expect(await slotOrder(page)).toEqual(base)
  expect(errors).toEqual([])
})

test("starts a new chat and switches back with the keyboard", async ({
  page,
  errors,
}) => {
  await ask(page, "put the overdue card first")
  await expect(log(page)).toContainText("Moved the Overdue card")

  await panel(page).getByRole("button", { name: "New chat" }).click()
  await expect(log(page)).not.toContainText("put the overdue card first")
  await expect(panel(page).getByRole("textbox", { name: "Ask" })).toBeFocused()
  await ask(page, "hide the average order value card")
  await expect(log(page)).toContainText("Hid the Average order value card")

  const switcher = panel(page).getByRole("button", {
    name: "Current chat: hide the average order value card",
  })
  await switcher.focus()
  await page.keyboard.press("Enter")
  const items = page.getByRole("menuitemradio")
  await expect(items).toHaveText([
    "hide the average order value card",
    "put the overdue card first",
  ])
  await expect(items.first()).toBeFocused()
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")

  await expect(
    panel(page).getByRole("button", {
      name: "Current chat: put the overdue card first",
    })
  ).toBeVisible()
  await expect(log(page)).toContainText("Moved the Overdue card")
  await expect(log(page)).not.toContainText("Hid the Average order value card")
  expect(errors).toEqual([])
})

test("forgets chats on a reload", async ({ page, errors }) => {
  await expect(panel(page)).toContainText(
    "Chats aren't saved. They clear when you leave the page."
  )
  await ask(page, "put the overdue card first")
  await expect(log(page)).toContainText("Moved the Overdue card")

  await page.reload()
  await openPanel(page)

  await expect(
    panel(page).getByRole("button", { name: "Current chat: New chat" })
  ).toBeVisible()
  await expect(log(page)).not.toContainText("put the overdue card first")
  await panel(page)
    .getByRole("button", { name: "Current chat: New chat" })
    .click()
  await expect(page.getByRole("menuitemradio")).toHaveCount(0)
  expect(errors).toEqual([])
})

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("keeps the chat, its preview and the prompt on screen", async ({
    page,
    errors,
  }) => {
    await ask(page, "put the overdue card first")
    const preview = log(page).getByRole("group", { name: "Preview" })

    await expect(
      preview.getByRole("button", { name: "Lock in" })
    ).toBeInViewport()
    await expect(
      panel(page).getByRole("textbox", { name: "Ask" })
    ).toBeInViewport({ ratio: 1 })
    expect((await panel(page).boundingBox())?.width).toBe(390)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true)
    expect(errors).toEqual([])
  })
})
