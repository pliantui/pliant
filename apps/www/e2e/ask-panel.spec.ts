import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"

const surface = "/examples/orders"

function region(page: Page) {
  return page.locator('[data-pliant-id="key-metrics"]')
}

async function slotOrder(page: Page) {
  return region(page)
    .locator(":scope > [data-pliant-id]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-pliant-id"))
    )
}

async function openPanel(page: Page) {
  await page.goto(surface)
  await expect(region(page)).not.toHaveAttribute("data-pliant-pending")
  await page.getByRole("button", { name: "Ask" }).click()
  const panel = page.getByRole("complementary", { name: "Ask" })
  await expect(panel.getByRole("textbox", { name: "Ask" })).toBeFocused()
  return panel
}

async function askAboutKeyMetrics(page: Page, prompt: string, answer: string) {
  const panel = await openPanel(page)
  await expect(panel.getByRole("combobox", { name: "Change" })).toHaveText(
    "Key metrics"
  )
  const textbox = panel.getByRole("textbox", { name: "Ask" })
  await textbox.fill(prompt)
  await textbox.press("Enter")
  await expect(panel.getByRole("status")).toContainText(answer)
  return panel
}

const base = ["revenue", "orders", "average-order-value", "overdue"]
const overdueFirst = ["overdue", "revenue", "orders", "average-order-value"]

test("previews an answer and keeps it after Lock in", async ({
  page,
  errors,
}) => {
  const panel = await askAboutKeyMetrics(
    page,
    "put the overdue card first",
    "Moved the Overdue card to the first position."
  )
  expect(await slotOrder(page)).toEqual(overdueFirst)

  await panel.getByRole("button", { name: "Lock in" }).click()
  await expect(panel.getByRole("status")).toHaveText("Locked in.")

  await page.reload()
  await expect(region(page)).not.toHaveAttribute("data-pliant-pending")
  expect(await slotOrder(page)).toEqual(overdueFirst)
  expect(errors).toEqual([])
})

test("drops the preview on Discard", async ({ page, errors }) => {
  const panel = await askAboutKeyMetrics(
    page,
    "put the overdue card first",
    "Moved the Overdue card to the first position."
  )
  expect(await slotOrder(page)).toEqual(overdueFirst)

  await panel.getByRole("button", { name: "Discard" }).click()
  await expect(panel.getByRole("status")).toHaveText("Discarded.")
  expect(await slotOrder(page)).toEqual(base)

  await page.reload()
  await expect(region(page)).not.toHaveAttribute("data-pliant-pending")
  expect(await slotOrder(page)).toEqual(base)
  expect(errors).toEqual([])
})

test("asks a suggestion", async ({ page, errors }) => {
  const panel = await openPanel(page)
  await panel
    .getByRole("group", { name: "Suggestions" })
    .getByRole("button", { name: "hide the average order value card" })
    .click()
  await expect(panel.getByRole("textbox", { name: "Ask" })).toBeFocused()
  await page.keyboard.press("Enter")

  await expect(panel.getByRole("status")).toContainText(
    "Hid the Average order value card"
  )
  expect(errors).toEqual([])
})

test("closes the target picker, not the panel, on Escape", async ({
  page,
  errors,
}) => {
  const panel = await openPanel(page)
  await panel.getByRole("combobox", { name: "Change" }).click()
  await expect(page.getByRole("listbox")).toBeVisible()

  await page.keyboard.press("Escape")

  await expect(page.getByRole("listbox")).toBeHidden()
  await expect(panel).toBeVisible()
  expect(errors).toEqual([])
})

for (const width of [1024, 1440]) {
  test(`leaves its trigger and the cards uncovered at ${String(width)}px`, async ({
    page,
    errors,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await askAboutKeyMetrics(
      page,
      "put the overdue card first",
      "Moved the Overdue card to the first position."
    )

    for (const locator of [
      page.getByRole("button", { name: "Ask" }),
      ...(await region(page).getByRole("group").all()),
    ]) {
      expect(
        await locator.evaluate((element) => {
          const { x, y, width, height } = element.getBoundingClientRect()
          const hit = document.elementFromPoint(x + width / 2, y + height / 2)
          return hit !== null && element.contains(hit)
        })
      ).toBe(true)
    }
    const spills = await region(page)
      .locator('[data-slot="card-title"]')
      .evaluateAll((titles) =>
        titles.flatMap((title) => {
          const header = title.closest('[data-slot="card-header"]')
          if (!header) {
            return [title.textContent]
          }
          const style = getComputedStyle(header)
          const content =
            header.clientWidth -
            parseFloat(style.paddingLeft) -
            parseFloat(style.paddingRight)
          return title.scrollWidth > content ? [title.textContent] : []
        })
      )
    expect(spills).toHaveLength(0)
    expect(errors).toEqual([])
  })
}

test("lists the recorded asks for any other ask", async ({ page, errors }) => {
  const panel = await askAboutKeyMetrics(
    page,
    "Put the overdue card first",
    "This demo only answers its recorded asks. Try one of the suggestions."
  )

  await expect(panel.getByRole("button", { name: "Lock in" })).toBeHidden()
  expect(errors).toEqual([])
})

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

  const tops = await region(page)
    .getByRole("group")
    .evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().top)
    )
  expect(new Set(tops).size).toBe(2)
  expect(errors).toEqual([])
})

test("doesn't trap focus or take Escape from the page", async ({
  page,
  errors,
}) => {
  const panel = await openPanel(page)
  const trigger = page.getByRole("button", { name: "Ask" })

  await page.getByRole("heading", { level: 1 }).evaluate((heading) => {
    heading.setAttribute("tabindex", "-1")
    heading.focus()
  })
  await page.keyboard.press("Escape")
  await expect(panel).toBeVisible()

  await trigger.focus()
  await page.keyboard.press("Tab")
  await expect(panel.getByRole("button", { name: "Close" })).toBeFocused()
  await panel
    .getByRole("group", { name: "Suggestions" })
    .getByRole("button")
    .last()
    .focus()
  await page.keyboard.press("Tab")
  await expect(panel.getByRole("button", { name: "Close" })).not.toBeFocused()
  expect(
    await page.evaluate(() =>
      document
        .querySelector('[data-slot="pliant-ask-panel"]')
        ?.contains(document.activeElement)
    )
  ).toBe(false)

  await panel.getByRole("textbox", { name: "Ask" }).focus()
  await page.keyboard.press("Escape")
  await expect(panel).toBeHidden()
  await expect(trigger).toBeFocused()
  expect(errors).toEqual([])
})

test("docks to the bottom on small screens, keeping the cards in view", async ({
  page,
  errors,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const asked = await askAboutKeyMetrics(
    page,
    "put the overdue card first",
    "Moved the Overdue card to the first position."
  )
  await expect(asked.getByRole("status")).toBeInViewport({ ratio: 1 })
  await expect(asked.getByRole("button", { name: "Lock in" })).toBeInViewport()

  const panel = await page
    .getByRole("complementary", { name: "Ask" })
    .boundingBox()
  const overdue = await page
    .getByRole("group", { name: "Overdue" })
    .boundingBox()
  expect(panel?.width).toBe(390)
  expect(panel && panel.y > 0).toBe(true)
  expect(overdue && panel && overdue.y + overdue.height <= panel.y).toBe(true)
  expect(errors).toEqual([])
})
